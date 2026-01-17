import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/ticket_detail_screen.dart';
import '../../models/work_item.dart';

class TicketsTab extends StatelessWidget {
  const TicketsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    final items = workFn.workItems.where((i) => i.type == WorkItemType.ticket).toList();

    return RefreshIndicator(
      onRefresh: () async {
         final user = Provider.of<AuthProvider>(context, listen: false).user;
         await workFn.refreshData(user);
      },
      child: ListView.builder(
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
