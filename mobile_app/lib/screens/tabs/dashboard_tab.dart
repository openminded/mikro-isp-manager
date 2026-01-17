import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/custom_card.dart';
import '../details/installation_detail_screen.dart';
import '../details/ticket_detail_screen.dart';
import '../../models/work_item.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
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
    final workItems = workFn.workItems;
    final isLoading = workFn.isLoading;

    // Summary Stats
    final myPending = workItems.where((i) => i.status != 'done' && i.status != 'cancel').length;
    final myCompleted = workItems.where((i) => i.status == 'done').length;

    return RefreshIndicator(
        onRefresh: () async {
            final user = Provider.of<AuthProvider>(context, listen: false).user;
            await workFn.refreshData(user);
        },
        child: isLoading && workItems.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                    Row(
                        children: [
                            Expanded(child: _buildStatCard('Pending', myPending.toString(), Colors.orange)),
                            const SizedBox(width: 16),
                            Expanded(child: _buildStatCard('Completed', myCompleted.toString(), Colors.green)),
                        ],
                    ),
                    const SizedBox(height: 24),
                    const Text('Recent Assignments', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    if (workItems.isEmpty)
                       const Padding(padding: EdgeInsets.all(24), child: Text("No jobs assigned.", textAlign: TextAlign.center, style: TextStyle(color: Colors.grey))),
                    
                    ...workItems.take(5).map((item) => WorkItemCard(
                        item: item,
                        onTap: () {
                           if (item.type == WorkItemType.installation) {
                               Navigator.of(context).push(MaterialPageRoute(builder: (_) => InstallationDetailScreen(item: item)));
                           } else {
                               Navigator.of(context).push(MaterialPageRoute(builder: (_) => TicketDetailScreen(item: item)));
                           }
                        },
                    )),
                ],
            ),
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
            border: Border.all(color: color.withOpacity(0.2))
        ),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
                const SizedBox(height: 4),
                Text(title, style: TextStyle(color: Colors.grey.shade600)),
            ],
        ),
    );
  }
}
