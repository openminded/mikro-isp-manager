import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../models/registration.dart';
import '../details/registration_detail_screen.dart';
import '../forms/registration_form_screen.dart';

class RegistrationsTab extends StatefulWidget {
  const RegistrationsTab({super.key});

  @override
  State<RegistrationsTab> createState() => _RegistrationsTabState();
}

class _RegistrationsTabState extends State<RegistrationsTab> {
  String? _selectedServer;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
       final user = Provider.of<AuthProvider>(context, listen: false).user;
       Provider.of<WorkProvider>(context, listen: false).refreshData(user);
    });
  }

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    final allRegistrations = workFn.registrations;
    
    // Filter by Server and Search Query
    List<Registration> filteredRegistrations = allRegistrations.where((r) {
      final matchesServer = _selectedServer == null || r.locationId == _selectedServer;
      final query = _searchQuery.toLowerCase();
      final matchesSearch = query.isEmpty || 
          r.fullName.toLowerCase().contains(query) || 
          r.phoneNumber.contains(query) || 
          r.address.toLowerCase().contains(query);
      return matchesServer && matchesSearch;
    }).toList();

    // 1. Queue: status 'queue'
    final queueList = filteredRegistrations.where((r) => r.status == 'queue').toList();
    // 2. Pending: status != 'queue' AND status != 'done' AND status != 'cancel'
    final pendingList = filteredRegistrations.where((r) => r.status != 'queue' && r.status != 'done' && r.status != 'cancel').toList();
    // 3. Complete (History): status 'done' OR 'cancel'
    final completeList = filteredRegistrations.where((r) => r.status == 'done' || r.status == 'cancel').toList();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(160), 
          child: Column(
            children: [
               Padding(
                 padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                 child: TextField(
                   decoration: InputDecoration(
                     hintText: 'Search registrations...',
                     prefixIcon: const Icon(Icons.search),
                     filled: true,
                     fillColor: Colors.white,
                     border: OutlineInputBorder(
                       borderRadius: BorderRadius.circular(8),
                       borderSide: BorderSide(color: Colors.grey.shade300),
                     ),
                     contentPadding: const EdgeInsets.symmetric(vertical: 0),
                   ),
                   onChanged: (val) {
                     setState(() {
                       _searchQuery = val;
                     });
                   },
                 ),
               ),
               Container(
                 margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                 padding: const EdgeInsets.symmetric(horizontal: 12),
                 decoration: BoxDecoration(
                   color: Colors.white,
                   borderRadius: BorderRadius.circular(8),
                   border: Border.all(color: Colors.grey.shade300),
                 ),
                 child: DropdownButtonHideUnderline(
                   child: DropdownButton<String>(
                     isExpanded: true,
                     hint: const Text('Filter by Server'),
                     value: _selectedServer,
                     items: [
                       const DropdownMenuItem<String>(
                         value: null,
                         child: Text('All Servers'),
                       ),
                       ...workFn.servers.map((s) => DropdownMenuItem(
                         value: s.name,
                         child: Text(s.name),
                       )).toList(),
                     ],
                     onChanged: (val) {
                       setState(() {
                         _selectedServer = val;
                       });
                     },
                   ),
                 ),
               ),
               const TabBar(
                 labelColor: Colors.blue,
                 unselectedLabelColor: Colors.grey,
                 indicatorColor: Colors.blue,
                 tabs: [
                   Tab(text: 'Queue'),
                   Tab(text: 'Pending'),
                   Tab(text: 'Complete'),
                 ],
               ),
            ],
          ),
        ),
        body: TabBarView(
          children: [
              _buildList(context, queueList, workFn),
              _buildList(context, pendingList, workFn),
              _buildList(context, completeList, workFn),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const RegistrationFormScreen()));
          },
          child: const Icon(Icons.add),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<Registration> list, WorkProvider workFn) {
      if (list.isEmpty) return const Center(child: Text('No data'));
      
      // Sort by Date Descending (Newest First)
      list.sort((a,b) => b.createdAt.compareTo(a.createdAt));

      return RefreshIndicator(
        onRefresh: () async {
           final user = Provider.of<AuthProvider>(context, listen: false).user;
           await workFn.refreshData(user);
        },
        child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: list.length,
              itemBuilder: (context, index) {
                  final reg = list[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: _getStatusColor(reg.status),
                        child: const Icon(Icons.person_add, color: Colors.white),
                      ),
                      title: Text(reg.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(reg.address),
                          if (reg.locationId.isNotEmpty)
                             Text('Server: ${reg.locationId}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                               Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                 decoration: BoxDecoration(
                                   color: _getStatusColor(reg.status).withOpacity(0.1),
                                   borderRadius: BorderRadius.circular(4),
                                 ),
                                 child: Text(
                                   reg.status.toUpperCase(), 
                                   style: TextStyle(fontSize: 10, color: _getStatusColor(reg.status), fontWeight: FontWeight.bold)
                                 ),
                               ),
                               const SizedBox(width: 8),
                               Text(reg.createdAt.split('T')[0], style: const TextStyle(fontSize: 12, color: Colors.grey)),
                            ],
                          )
                        ],
                      ),
                      trailing: reg.status == 'queue' ? const Icon(Icons.arrow_forward_ios, size: 16) : null,
                      onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => RegistrationDetailScreen(registration: reg)));
                      },
                    ),
                  );
              },
        ),
      );
  }
  Color _getStatusColor(String status) {
    if (status == 'queue') return Colors.orange;
    if (status == 'done') return Colors.green;
    if (status == 'cancel') return Colors.red;
    return Colors.blue; 
  }
}
