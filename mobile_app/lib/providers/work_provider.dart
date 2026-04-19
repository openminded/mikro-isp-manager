import 'package:flutter/material.dart';
import '../models/work_item.dart';
import '../models/registration.dart';
import '../models/ticket.dart';
import '../models/server.dart';
import '../services/api_service.dart';
import '../models/user.dart';
import '../models/employee.dart';
import '../models/job_title.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/notification_service.dart';
import '../models/sub_area.dart';

class WorkProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  
  List<WorkItem> _workItems = [];
  List<Server> _servers = [];
  List<Registration> _registrations = [];
  bool _isLoading = false;

  List<Employee> _employees = [];
  List<JobTitle> _jobTitles = [];
  List<SubArea> _subAreas = [];

  List<WorkItem> get workItems => _workItems;
  List<Server> get servers => _servers;
  List<Registration> get registrations => _registrations;
  List<SubArea> get subAreas => _subAreas;
  bool get isLoading => _isLoading;
  List<Employee> get technicians {
     final techTitles = _jobTitles.where((t) {
        final name = t.name.toLowerCase();
        return name.contains('technician') || name.contains('teknisi') || name.contains('technical');
     }).map((t) => t.id).toSet();
     
     return _employees.where((e) => techTitles.contains(e.jobTitleId)).toList();
  }

  Future<void> refreshData(User? user) async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/servers'),
        _api.get('/registrations'),
        _api.get('/tickets'),
        _api.get('/employees'),
        _api.get('/job-titles'),
        _api.get('/sub-areas'),
      ]);

      final serverList = (results[0] as List).map((x) => Server.fromJson(x)).toList();
      final regList = (results[1] as List).map((x) => Registration.fromJson(x)).toList();
      final ticketList = (results[2] as List).map((x) => Ticket.fromJson(x)).toList();
      final empList = (results[3] as List).map((x) => Employee.fromJson(x)).toList();
      final titleList = (results[4] as List).map((x) => JobTitle.fromJson(x)).toList();
      final subAreaList = (results[5] as List).map((x) => SubArea.fromJson(x)).toList();

      _servers = serverList;
      _registrations = regList;
      _employees = empList;
      _jobTitles = titleList;
      _subAreas = subAreaList;
      _workItems = _processWorkItems(regList, ticketList, user);
      
      // Check for notifications
      if (user != null) {
         await _checkForNewItems(user);
      }
    } catch (e) {
      print('Error fetching data: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  List<WorkItem> _processWorkItems(List<Registration> regs, List<Ticket> tickets, User? user) {
    List<WorkItem> items = [];

    // Process Registrations
    for (var r in regs) {
      String status = 'in_progress';
      if (r.status == 'done' && r.workingOrderStatus == 'done') status = 'done';
      if (r.status == 'cancel') status = 'cancel';
      if (r.workingOrderStatus == 'pending') status = 'pending';

      // Filtering logic similar to Web
      // Show only if not queued
      if (r.status == 'queue') continue;

      // Web App Logic: if (view === 'progress' && r.status !== 'installation_process' && r.status !== 'done') return;
      // In Mobile, we separate Tabs. But usually we only want to see actionable items in local list.
      // If we strictly follow Web "In Progress" view:
      // if (status != 'done' && r.status != 'installation_process' && r.status != 'done') continue; 
      // But let's act generously for now to ensure visibility.
      // Admins need to see 'queue' to process them in RegistrationsTab.
      // Technicians don't see queue.


      String techName = r.installation?.technician ?? '';
      if (techName.isEmpty) techName = 'Unassigned';

      items.add(WorkItem(
        id: r.id,
        type: WorkItemType.installation,
        customerName: r.fullName,
        phoneNumber: r.phoneNumber,
        address: r.address,
        server: r.locationId,
        technician: techName,
        companion: r.installation?.companion,
        date: r.installation?.date ?? '',
        status: status,
        rawStatus: status == 'pending' ? 'Pending' : (status == 'done' ? 'Completed' : 'Installation'),
        note: r.workingOrderNote,
        originalObject: r,
        mapsUrl: r.mapsUrl,
      ));
    }

    // Process Tickets
    for (var t in tickets) {
      String status = 'in_progress';
      if (t.status == 'resolved' || t.status == 'closed') status = 'done';
      if (t.status == 'open') status = 'pending'; // Treat Open as Pending for unified view

      String techName = t.technician ?? '';
      if (techName.isEmpty) techName = 'Unassigned';

      items.add(WorkItem(
        id: t.id,
        type: WorkItemType.ticket,
        customerName: t.customerName,
        phoneNumber: t.customerPhone,
        address: t.customerAddress ?? '-',
        server: t.locationId,
        technician: techName,
        companion: null, // Tickets might not have companion field yet
        date: t.createdAt,
        status: status, // mapped status
        rawStatus: t.status,
        note: t.status == 'open' ? 'Waiting Assignment' : t.description,
        originalObject: t,
      ));
    }

    // Filter by User Logic (if technician)
    if (user != null && user.role == 'technician') {
       // Show assigned to self, companion to self, OR Unassigned
       items = items.where((i) => i.technician == user.name || i.companion == user.name || i.technician == 'Unassigned').toList();
    }


    // Sort by Date Descending
    items.sort((a, b) => b.date.compareTo(a.date));

    return items;
  }

  Future<void> updateInstallationStatus(String id, String action, String note) async {
    Map<String, dynamic> updates = {'workingOrderNote': note};
    if (action == 'pending') {
      updates['workingOrderStatus'] = 'pending';
      updates['status'] = 'installation_process';
    } else if (action == 'cancel') {
      updates['status'] = 'cancel';
      updates['workingOrderStatus'] = 'done';
    }
    await _api.put('/registrations/$id', updates);
  }
  
  Future<void> completeInstallation(String id, String secretId, String serverId, String? profileName, String coordinates, String secretName, List<String> photoPaths, {List<String>? existingPhotos}) async {
     
     final server = _servers.firstWhere((s) => s.id == serverId || s.name == serverId, orElse: () => throw Exception('Server not found'));
     
     final dateStr = DateTime.now().toIso8601String().split('T')[0];
     final item = _workItems.firstWhere((i) => i.id == id);
     final reg = item.originalObject as Registration;
     // Only set secret on router if not already set or if explicitly updating? 
     // For update, we might re-set it, which is fine (overwrite).
     
     final newComment = '${server.name} - ${reg.fullName} - $dateStr';

     List<String> command = ['/ppp/secret/set', '=.id=$secretId', '=comment=$newComment'];
     if(profileName != null && profileName.isNotEmpty) {
        command.add('=profile=$profileName');
     }

     await _api.post('/proxy', {
        'host': server.ip,
        'user': server.username,
        'password': server.password,
        'port': server.port,
        'command': command
     });

     // 2. Update Registration via Multipart (Complete Endpoint)
     Map<String, String> fields = {
        'secretId': secretId,
        'secretName': secretName,
        'note': reg.workingOrderNote ?? '', 
        'coordinates': coordinates
     };
     
     if (existingPhotos != null && existingPhotos.isNotEmpty) {
        // Simple manual JSON stringify since we can't depend on dart:convert easily without import? 
        // We import ApiService which uses dart:convert. WorkProvider likely doesn't have it imported? 
        // Let's check imports.
        // It's not imported. But we can import it.
        // Or manual: "[\"url1\", \"url2\"]"
        String jsonPhotos = '[' + existingPhotos.map((e) => '"$e"').join(',') + ']';
        fields['existingPhotos'] = jsonPhotos;
     }

     await _api.postMultipartRequest('/registrations/$id/complete', fields, photoPaths, 'photos');

     // Trigger refresh to update the list locally
     // We need to pass 'user' to refreshData, but we don't have it here. 
     // We can just rely on the Caller (UI) to handle refresh OR we update local item status manually.
     // Manual update is faster.
     final index = _workItems.indexWhere((i) => i.id == id);
     if (index != -1) {
         final old = _workItems[index];
         _workItems[index] = WorkItem(
             id: old.id,
             type: old.type,
             customerName: old.customerName,
             phoneNumber: old.phoneNumber,
             address: old.address,
             server: old.server,
             technician: old.technician,
             companion: old.companion,
             date: old.date,
             status: 'done', // Update status to done
             rawStatus: 'Completed',
             note: old.note,
             originalObject: old.originalObject, // Ideally update this too but for list view status is key
             mapsUrl: old.mapsUrl
         );
         notifyListeners();
     }
  }

  Future<List<dynamic>> fetchSecrets(String serverName) async {
      try {
          final server = _servers.firstWhere((s) => s.name == serverName || s.id == serverName);
          final res = await _api.post('/proxy', {
                'host': server.ip,
                'user': server.username,
                'password': server.password,
                'port': server.port,
                'command': '/ppp/secret/print'
          });
          if (res is List) return res;
          return [];
      } catch (e) {
          print('Fetch secrets error: $e');
          return [];
      }
  }

  Future<List<dynamic>> fetchProfiles(String serverName) async {
      try {
          final server = _servers.firstWhere((s) => s.name == serverName || s.id == serverName);
          final res = await _api.post('/proxy', {
                'host': server.ip,
                'user': server.username,
                'password': server.password,
                'port': server.port,
                'command': '/ppp/profile/print'
          });
          if (res is List) return res;
          return [];
      } catch (e) {
          print('Fetch profiles error: $e');
          return [];
      }
  }

  Future<void> resolveTicket(String id, String solution) async {
    await _api.put('/tickets/$id', {
       'status': 'resolved',
       'solution': solution,
       'resolvedAt': DateTime.now().toIso8601String()
    });
  }

  // Admin Actions
  Future<void> processInstallation(String id, String technician, String companion, String date, {Map<String, dynamic>? cost}) async {
    await _api.put('/registrations/$id', {
      'status': 'installation_process',
      'workingOrderStatus': 'pending', 
      'installation': {
        'technician': technician,
        'companion': companion,
        'date': date,
        'cost': cost
      }
    });
    // Refresh local data will be handled by UI calling refreshData or we can do it here
  }

  Future<void> updateInstallationDetails(String id, String technician, String companion, String date) async {
    await _api.put('/registrations/$id', {
      'installation': {
        'technician': technician,
        'companion': companion,
        'date': date
      }
    });
    // Refresh handled by caller or global refresh
  }

  Future<void> cancelRegistration(String id) async {
    await _api.put('/registrations/$id', {
      'status': 'cancel',
      'workingOrderStatus': 'cancel', // Ensure installation is also cancelled
    });
  }

  Future<void> createRegistration(Map<String, dynamic> data) async {
    await _api.post('/registrations', data);
  }

  Future<void> updateRegistration(String id, Map<String, dynamic> data) async {
    await _api.put('/registrations/$id', data);
  }

  Future<void> createTicket(Map<String, dynamic> data) async {
    await _api.post('/tickets', data);
  }


  Future<void> _checkForNewItems(User user) async {
      final prefs = await SharedPreferences.getInstance();
      final lastKnownIds = prefs.getStringList('known_work_item_ids') ?? [];
      
      final currentIds = _workItems.map((i) => i.id).toList();
      final newIds = currentIds.where((id) => !lastKnownIds.contains(id)).toList();
      
      if (newIds.isNotEmpty && lastKnownIds.isNotEmpty) {
          // Only notify if we had previous data (to avoid spamming on first login)
          // Or strictly notify for anything NEW that wasn't there before.
          // Better: If lastKnownIds is empty, we just save currentIds and don't notify (initial load).
          
           for (var id in newIds) {
               final item = _workItems.firstWhere((i) => i.id == id);
               // Send Notification
               // "Hi @namateknisi baru pesannya" -> "Hi @technicianName ..."
               final techName = user.name;
               final type = item.type == WorkItemType.installation ? 'Installation' : 'Ticket';
               
               // Construct message
               // Requirement: "HI @namateknisi baru pesannya" (Assuming "baru pesannya" means "here is the message" or just content)
               // User asked: "dalam pesan notifikasi, jangan lupa menambahkan HI @namateknisi baru pesannya"
               // Interpreting "baru pesannya" as "then the message".
               // Let's make it natural: "Hi @[Name], New [Type] available at [Address]"
               
               final title = 'New Work Item Received';
               final body = 'Hi @$techName, you have a new $type at ${item.address}.';
               
               // Use hashcode of ID for notification ID (needs int)
               await NotificationService().showNotification(
                   id: id.hashCode, 
                   title: title, 
                   body: body,
                   payload: id
               );
           }
      }
      
      // Update known IDs
      await prefs.setStringList('known_work_item_ids', currentIds);
  }
}
