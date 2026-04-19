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
    final allItems = workFn.workItems;
    final isLoading = workFn.isLoading;

    // Filter by search query
    final workItems = allItems.where((i) {
      final query = _searchQuery.toLowerCase();
      if (query.isEmpty) return true;
      return i.customerName.toLowerCase().contains(query) || 
             i.phoneNumber.contains(query) || 
             i.address.toLowerCase().contains(query);
    }).toList();

    // Summary Stats
    final myPending = allItems.where((i) => i.status != 'done' && i.status != 'cancel').length;
    final myCompleted = allItems.where((i) => i.status == 'done').length;

    return RefreshIndicator(
        onRefresh: () async {
            final user = Provider.of<AuthProvider>(context, listen: false).user;
            await workFn.refreshData(user);
        },
        child: isLoading && allItems.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                    Row(
                        children: [
                            Expanded(child: _buildStatCard('Pending', myPending.toString(), [Colors.orange.shade400, Colors.deepOrange.shade600])),
                            const SizedBox(width: 16),
                            Expanded(child: _buildStatCard('Completed', myCompleted.toString(), [Colors.green.shade400, Colors.teal.shade700])),
                        ],
                    ),
                    const SizedBox(height: 24),
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Search assignments...',
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
                    const SizedBox(height: 24),
                    const Text('Recent Assignments', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    if (workItems.isEmpty)
                       Padding(padding: const EdgeInsets.all(24), child: Text(_searchQuery.isEmpty ? "No jobs assigned." : "No matching assignments.", textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey))),
                    
                    ...workItems.take(10).map((item) => WorkItemCard(
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

  Widget _buildStatCard(String title, String value, List<Color> colors) {
    return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
            gradient: LinearGradient(
                colors: colors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
                BoxShadow(
                    color: colors.last.withOpacity(0.4),
                    blurRadius: 8,
                    offset: const Offset(2, 4)
                )
            ],
        ),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Text(value, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 4),
                Text(title, style: const TextStyle(color: Colors.white70, fontSize: 16)),
            ],
        ),
    );
  }
}
