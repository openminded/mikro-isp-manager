import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/ticket_detail_screen.dart';
import '../../models/work_item.dart';

import '../forms/ticket_form_screen.dart';

class TicketsTab extends StatelessWidget {
  const TicketsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    final items = workFn.workItems.where((i) => i.type == WorkItemType.ticket).toList();
    final auth = Provider.of<AuthProvider>(context, listen: false);

    final openItems = items.where((i) => i.status == 'pending' || i.status == 'in_progress').toList();
    final resolvedItems = items.where((i) => i.status == 'done').toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: DefaultTabController(
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
                  _buildList(context, openItems, workFn, auth),
                  _buildList(context, resolvedItems, workFn, auth),
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
