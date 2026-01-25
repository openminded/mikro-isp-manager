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
    final registrations = workFn.registrations;
    


    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: const TabBar(
             labelColor: Colors.blue,
             unselectedLabelColor: Colors.grey,
             indicatorColor: Colors.blue,
             tabs: [
               Tab(text: 'Queue'),
               Tab(text: 'History'),
             ],
        ),
        body: TabBarView(
          children: [
              // Queue Tab
              _buildList(context, registrations.where((r) => r.status == 'queue').toList(), workFn),
              // History Tab (Active + Done)
              _buildList(context, registrations.where((r) => r.status != 'queue').toList(), workFn),
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
      
      // Sort: Queue by date, History by date DESC
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
                          Text('Status: ${reg.status} / ${reg.workingOrderStatus}'),
                          Text(reg.createdAt.split('T')[0]),
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
    switch (status) {
      case 'queue': return Colors.orange;
      case 'done': return Colors.green;
      case 'cancel': return Colors.red;
      default: return Colors.blue;
    }
  }
}
