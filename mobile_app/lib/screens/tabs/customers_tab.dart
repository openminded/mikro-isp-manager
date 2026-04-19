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
  String _searchQuery = '';

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
    final allCustomers = customerProvider.customers;

    final customers = allCustomers.where((c) {
      final query = _searchQuery.toLowerCase();
      if (query.isEmpty) return true;
      return c.name.toLowerCase().contains(query) || 
             (c.whatsapp != null && c.whatsapp!.contains(query)) || 
             c.profile.toLowerCase().contains(query) ||
             (c.realName != null && c.realName!.toLowerCase().contains(query));
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search customers...',
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
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
               await customerProvider.fetchCustomers();
            },
            child: customerProvider.isLoading && allCustomers.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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
          ),
        ),
      ],
    );
  }
}
