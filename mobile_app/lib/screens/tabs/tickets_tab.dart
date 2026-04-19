import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/ticket_detail_screen.dart';
import '../../models/work_item.dart';

import '../forms/ticket_form_screen.dart';

class TicketsTab extends StatefulWidget {
  const TicketsTab({super.key});

  @override
  State<TicketsTab> createState() => _TicketsTabState();
}

class _TicketsTabState extends State<TicketsTab> {
  String? _selectedServer;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    var allItems = workFn.workItems.where((i) => i.type == WorkItemType.ticket).toList();
    final auth = Provider.of<AuthProvider>(context, listen: false);

    // Filter by Server and Search Query
    var items = allItems.where((i) {
      final matchesServer = _selectedServer == null || i.server == _selectedServer;
      final query = _searchQuery.toLowerCase();
      final matchesSearch = query.isEmpty || 
          i.customerName.toLowerCase().contains(query) || 
          i.phoneNumber.contains(query) || 
          (i.address != null && i.address!.toLowerCase().contains(query)) ||
          (i.technician != null && i.technician!.toLowerCase().contains(query));
      return matchesServer && matchesSearch;
    }).toList();

    // Sort Descending
    items.sort((a, b) => (b.date).compareTo(a.date));

    final inProgressItems = items.where((i) => i.status == 'in_progress').toList();
    final pendingItems = items.where((i) => i.status == 'pending').toList();
    final completedItems = items.where((i) => i.status == 'done').toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: DefaultTabController(
        length: 3,
        child: Column(
          children: [
            Padding(
                 padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                 child: TextField(
                   decoration: InputDecoration(
                     hintText: 'Search tickets...',
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
            Container(
             color: Colors.blue.shade50,
             child: const TabBar(
               labelColor: Colors.blue,
               unselectedLabelColor: Colors.grey,
               indicatorColor: Colors.blue,
               tabs: [
                 Tab(text: 'In Progress'),
                 Tab(text: 'Pending'),
                 Tab(text: 'Complete'),
               ],
             ),
           ),
           Expanded(
             child: TabBarView(
               children: [
                  _buildList(context, inProgressItems, workFn, auth),
                  _buildList(context, pendingItems, workFn, auth),
                  _buildList(context, completedItems, workFn, auth),
               ],
             ),
           )
          ],
        ),
      ),
      floatingActionButton: (auth.user?.role == 'admin' || auth.user?.role == 'superadmin') ? FloatingActionButton(
        onPressed: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const TicketFormScreen()));
        },
        child: const Icon(Icons.add),
      ) : null,
    );
  }

  Widget _buildList(BuildContext context, List<WorkItem> items, WorkProvider workFn, AuthProvider auth) {
     if (items.isEmpty) {
        return const Center(child: Text('No tickets found', style: TextStyle(color: Colors.grey)));
     }
     return RefreshIndicator(
        onRefresh: () async {
           final user = auth.user;
           await workFn.refreshData(user);
        },
        child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (context, index) {
                    final item = items[index];
                    return WorkItemCard(
                        item: item,
                        onTap: () {
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => TicketDetailScreen(item: item)));
                        },
                    );
                },
              ),
      );
  }
}
