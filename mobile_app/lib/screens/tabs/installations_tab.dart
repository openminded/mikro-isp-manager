import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/installation_detail_screen.dart';
import '../../models/work_item.dart';

class InstallationsTab extends StatefulWidget {
  const InstallationsTab({super.key});

  @override
  State<InstallationsTab> createState() => _InstallationsTabState();
}

class _InstallationsTabState extends State<InstallationsTab> {
  String? _selectedServer;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    var allItems = workFn.workItems.where((i) => i.type == WorkItemType.installation).toList();
    
    // Filter by Server and Search Query
    var items = allItems.where((i) {
      final matchesServer = _selectedServer == null || i.server == _selectedServer;
      final query = _searchQuery.toLowerCase();
      final matchesSearch = query.isEmpty || 
          i.customerName.toLowerCase().contains(query) || 
          i.phoneNumber.contains(query) || 
          i.address.toLowerCase().contains(query) ||
          (i.technician != null && i.technician!.toLowerCase().contains(query));
      return matchesServer && matchesSearch;
    }).toList();
    
    // Sort Descending
    items.sort((a, b) => (b.date).compareTo(a.date));

    // Tab 1: In Progress
    final inProgressItems = items.where((i) => i.status == 'installation_process' || i.status == 'in_progress').toList();
    
    // Tab 2: Pending / Cancel
    final pendingCancelItems = items.where((i) => i.status == 'pending' || i.status == 'cancel').toList();
    
    // Tab 3: Completed
    final completedItems = items.where((i) => i.status == 'done').toList();

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
                     hintText: 'Search installations...',
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
                   Tab(text: 'In Progress'),
                   Tab(text: 'Pending'),
                   Tab(text: 'Complete'),
                 ],
               ),
            ],
          ),
        ),
        body: TabBarView(
          children: [
              _buildList(context, inProgressItems, workFn, canReinstall: false),
              _buildList(context, pendingCancelItems, workFn, canReinstall: true),
              _buildList(context, completedItems, workFn, canReinstall: false),
          ],
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<WorkItem> items, WorkProvider workFn, {required bool canReinstall}) {
    if (items.isEmpty) {
        return const Center(child: Text('No installations found', style: TextStyle(color: Colors.grey)));
    }
    return RefreshIndicator(
      onRefresh: () async {
         final user = Provider.of<AuthProvider>(context, listen: false).user;
         await workFn.refreshData(user);
      },
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (context, index) {
            final item = items[index];
            return Column(
              children: [
                WorkItemCard(
                    item: item,
                    onTap: () {
                        Navigator.of(context).push(MaterialPageRoute(builder: (_) => InstallationDetailScreen(item: item)));
                    },
                ),
                if (canReinstall && (item.status == 'pending' || item.status == 'cancel'))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.refresh, size: 16),
                        label: const Text('Re-Install (Set to In Progress)'),
                        onPressed: () async {
                          // Call provider to set back to installation_process
                          // Create a dialog to show progress
                          showDialog(
                            context: context, 
                            barrierDismissible: false,
                            builder: (_) => const Center(child: CircularProgressIndicator())
                          );
                          
                          try {
                             await workFn.updateInstallationStatus(item.id, 'pending', 'Re-install requested by tech');
                             if (context.mounted) {
                                Navigator.pop(context); // Close loader
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Installation moved to In Progress')));
                                // Refresh to update lists will happen automatically via provider notify or we can force it
                                final user = Provider.of<AuthProvider>(context, listen: false).user;
                                workFn.refreshData(user);
                             }
                          } catch (e) {
                             if (context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                             }
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.orange,
                          side: const BorderSide(color: Colors.orange),
                        ),
                      ),
                    ),
                  )
              ],
            );
        },
      ),
    );
  }
}
