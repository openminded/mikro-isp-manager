import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/installation_detail_screen.dart';
import '../../models/work_item.dart';

class InstallationsTab extends StatelessWidget {
  const InstallationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    // Filter out 'cancel' if needed, or put them in 'Selesai' or separate? Usually Selesai or History.
    // For now: 'Belum Selesai' = pending/install_process. 'Selesai' = done/cancel.
    final items = workFn.workItems.where((i) => i.type == WorkItemType.installation).toList();
    
    final pendingItems = items.where((i) => i.status == 'pending' || i.status == 'installation_process' || i.status == 'in_progress').toList();
    final doneItems = items.where((i) => i.status == 'done' || i.status == 'cancel').toList();

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
           Container(
             color: Colors.blue.shade50,
             child: const TabBar(
               labelColor: Colors.blue,
               unselectedLabelColor: Colors.grey,
               indicatorColor: Colors.blue,
               tabs: [
                 Tab(text: 'In Progress'),
                 Tab(text: 'Completed'),
               ],
             ),
           ),
           Expanded(
             child: TabBarView(
               children: [
                  _buildList(context, pendingItems, workFn),
                  _buildList(context, doneItems, workFn),
               ],
             ),
           )
        ],
      )
    );
  }

  Widget _buildList(BuildContext context, List<WorkItem> items, WorkProvider workFn) {
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
            return WorkItemCard(
                item: item,
                onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => InstallationDetailScreen(item: item)));
                },
            );
        },
      ),
    );
  }
}
