import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_provider.dart';
import '../../providers/auth_provider.dart';

import '../details/customer_detail_screen.dart';

class CustomersTab extends StatefulWidget {
  const CustomersTab({super.key});

  @override
  State<CustomersTab> createState() => _CustomersTabState();
}

class _CustomersTabState extends State<CustomersTab> {

  @override
  void initState() {
    super.initState();
    Future.microtask(() => 
      Provider.of<CustomerProvider>(context, listen: false).fetchCustomers()
    );
  }

  @override
  Widget build(BuildContext context) {
    final customerProvider = Provider.of<CustomerProvider>(context);
    final customers = customerProvider.customers;

    return RefreshIndicator(
      onRefresh: () async {
         await customerProvider.fetchCustomers();
      },
      child: customerProvider.isLoading 
        ? const Center(child: CircularProgressIndicator())
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: customers.length,
            itemBuilder: (context, index) {
                final customer = customers[index];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: customer.disabled ? Colors.red.shade100 : Colors.green.shade100,
                      child: Icon(
                        customer.disabled ? Icons.lock : Icons.check_circle,
                        color: customer.disabled ? Colors.red : Colors.green,
                      ),
                    ),
                    title: Text(customer.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                         if (customer.realName != null) Text(customer.realName!),
                         Text('${customer.serverName} • ${customer.profile}'),
                         if (customer.whatsapp != null) Text(customer.whatsapp!),
                      ],
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => CustomerDetailScreen(customer: customer)));
                    },
                  ),
                );
            },
          ),
    );
  }
}
