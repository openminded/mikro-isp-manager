import 'package:flutter/material.dart';
import '../models/work_item.dart';
import '../models/registration.dart';
import '../models/ticket.dart';
import '../models/server.dart';
import '../services/api_service.dart';
import '../models/user.dart';

class WorkProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  
  List<WorkItem> _workItems = [];
  List<Server> _servers = [];
  bool _isLoading = false;

  List<WorkItem> get workItems => _workItems;
  List<Server> get servers => _servers;
  bool get isLoading => _isLoading;

  Future<void> refreshData(User? user) async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/servers'),
        _api.get('/registrations'),
        _api.get('/tickets'),
      ]);

      final serverList = (results[0] as List).map((x) => Server.fromJson(x)).toList();
      final regList = (results[1] as List).map((x) => Registration.fromJson(x)).toList();
      final ticketList = (results[2] as List).map((x) => Ticket.fromJson(x)).toList();

      _servers = serverList;
      _workItems = _processWorkItems(regList, ticketList, user);
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

      items.add(WorkItem(
        id: r.id,
        type: WorkItemType.installation,
        customerName: r.fullName,
        phoneNumber: r.phoneNumber,
        address: r.address,
        server: r.locationId,
        technician: r.installation?.technician ?? 'Unassigned',
        date: r.installation?.date ?? '',
        status: status,
        rawStatus: status == 'pending' ? 'Pending' : (status == 'done' ? 'Completed' : 'Installation'),
        note: r.workingOrderNote,
        originalObject: r,
      ));
    }

    // Process Tickets
    for (var t in tickets) {
      String status = 'in_progress';
      if (t.status == 'resolved' || t.status == 'closed') status = 'done';
      if (t.status == 'open') status = 'pending'; // Treat Open as Pending for unified view

      items.add(WorkItem(
        id: t.id,
        type: WorkItemType.ticket,
        customerName: t.customerName,
        phoneNumber: t.customerPhone,
        address: t.customerAddress ?? '-',
        server: t.locationId,
        technician: t.technician ?? 'Unassigned',
        date: t.createdAt,
        status: status, // mapped status
        rawStatus: t.status,
        note: t.status == 'open' ? 'Waiting Assignment' : t.description,
        originalObject: t,
      ));
    }

    // Filter by User Logic (if technician)
    if (user != null && user.role == 'technician') {
       items = items.where((i) => i.technician == user.name).toList();
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
  
  Future<void> completeInstallation(String id, String secretId, String serverId) async {
     // Fetch server details first needed? No, we need to proxy.
     // Mobile logic for binding is complex.
     // For now, let's implement the basic update status part. 
     // The proxy call needs full server credentials which we have in _servers.
     
     final server = _servers.firstWhere((s) => s.id == serverId || s.name == serverId, orElse: () => throw Exception('Server not found'));
     
     // Get Registration to find name for comment
     // Assuming we have it in memory or fetch fresh?
     
     // 1. Bind Secret
     final dateStr = DateTime.now().toIso8601String().split('T')[0];
     // We need the registration object.
     final item = _workItems.firstWhere((i) => i.id == id);
     final reg = item.originalObject as Registration;
     final newComment = '${server.name} - ${reg.fullName} - $dateStr';

     await _api.post('/proxy', {
        'host': server.ip,
        'user': server.username,
        'password': server.password,
        'port': server.port,
        'command': ['/ppp/secret/set', '=.id=$secretId', '=comment=$newComment']
     });

     // 2. Update Registration
     await _api.put('/registrations/$id', {
        'workingOrderStatus': 'done',
        'status': 'done',
        'installation': {
           // We prefer to keep existing fields, so backend should handle merge? 
           // PUT usually replaces in REST, but our backend implementation uses `...updates` so it merges.
           // However installation object inside might be replaced if we send partial?
           // Backend: db[index] = { ...db[index], ...updates };
           // If we send installation: { finishDate: ... }, it replaces the whole installation object? 
           // Yes, unless we send the full object.
           'technician': reg.installation?.technician ?? '',
           'date': reg.installation?.date ?? '',
           'finishDate': DateTime.now().toIso8601String()
        }
     });
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

  Future<void> resolveTicket(String id, String solution) async {
    await _api.put('/tickets/$id', {
       'status': 'resolved',
       'solution': solution,
       'resolvedAt': DateTime.now().toIso8601String()
    });
  }
}
