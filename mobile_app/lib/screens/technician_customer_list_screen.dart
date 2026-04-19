import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/customer_provider.dart';
import '../providers/work_provider.dart';
import '../models/customer.dart';
import 'details/customer_detail_screen.dart';

class TechnicianCustomerListScreen extends StatefulWidget {
  const TechnicianCustomerListScreen({super.key});

  @override
  State<TechnicianCustomerListScreen> createState() => _TechnicianCustomerListScreenState();
}

class _TechnicianCustomerListScreenState extends State<TechnicianCustomerListScreen> {
  String _searchQuery = '';
  String? _selectedServerId;
  String? _selectedSubAreaId;

  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        Provider.of<CustomerProvider>(context, listen: false).fetchCustomers());
  }

  @override
  Widget build(BuildContext context) {
    final customerProvider = Provider.of<CustomerProvider>(context);
    final work = Provider.of<WorkProvider>(context);

    final filteredCustomers = customerProvider.customers.where((c) {
      // Search filter
      final query = _searchQuery.toLowerCase();
      final matchesSearch = query.isEmpty ||
          (c.comment?.toLowerCase().contains(query) ?? false) ||
          c.name.toLowerCase().contains(query) ||
          (c.whatsapp?.contains(query) ?? false);
      if (!matchesSearch) return false;

      // Server filter
      if (_selectedServerId != null && c.serverId != _selectedServerId) {
        return false;
      }

      // Sub Area filter
      if (_selectedSubAreaId != null && c.subAreaId != _selectedSubAreaId) {
        return false;
      }

      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer List', style: TextStyle(fontWeight: FontWeight.bold)),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF3949AB), Color(0xFF283593)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter Bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                // Search Input
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search name, username, phone...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: Colors.grey.shade100,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                  onChanged: (val) => setState(() => _searchQuery = val),
                ),
                const SizedBox(height: 12),
                // Dropdowns
                Row(
                  children: [
                    // Server Dropdown
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedServerId,
                            hint: const Text('All Servers', style: TextStyle(fontSize: 12)),
                            isExpanded: true,
                            items: [
                              const DropdownMenuItem(value: null, child: Text('All Servers', style: TextStyle(fontSize: 12))),
                              ...work.servers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, style: const TextStyle(fontSize: 12)))),
                            ],
                            onChanged: (val) {
                              setState(() {
                                _selectedServerId = val;
                                _selectedSubAreaId = null; // Reset sub-area on server change
                              });
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Sub Area Dropdown
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedSubAreaId,
                            hint: const Text('All Areas', style: TextStyle(fontSize: 12)),
                            isExpanded: true,
                            items: [
                              const DropdownMenuItem(value: null, child: Text('All Areas', style: TextStyle(fontSize: 12))),
                              ...work.subAreas
                                  .where((s) => _selectedServerId == null || s.serverId == _selectedServerId)
                                  .map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, style: const TextStyle(fontSize: 12)))),
                            ],
                            onChanged: (val) => setState(() => _selectedSubAreaId = val),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Results Count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Text(
                  'Showing ${filteredCustomers.length} customers',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => customerProvider.fetchCustomers(),
              child: customerProvider.isLoading && filteredCustomers.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filteredCustomers.length,
                      itemBuilder: (context, index) {
                        final c = filteredCustomers[index];
                        return _CustomerCard(customer: c);
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  const _CustomerCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CustomerDetailScreen(customer: customer))),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Name & Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      customer.comment ?? customer.name,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _StatusChip(disabled: customer.disabled),
                ],
              ),
              const SizedBox(height: 8),
              
              // Username & Profile
              Row(
                children: [
                   const Icon(Icons.person_outline, size: 14, color: Colors.grey),
                   const SizedBox(width: 4),
                   Text(customer.name, style: const TextStyle(fontSize: 12, color: Colors.blue, fontWeight: FontWeight.bold)),
                   const SizedBox(width: 8),
                   const Icon(Icons.speed, size: 14, color: Colors.grey),
                   const SizedBox(width: 4),
                   Text(customer.profile, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const Divider(height: 24),

              // Details Grid
              _DetailRow(label: 'IP Address', value: customer.remoteAddress ?? '-', icon: Icons.network_check),
              _DetailRow(label: 'Phone/WA', value: customer.whatsapp ?? '-', icon: Icons.phone_android),
              _DetailRow(label: 'KTP Number', value: customer.ktp ?? '-', icon: Icons.badge),
              _DetailRow(label: 'Last Logout', value: customer.lastLoggedOut ?? '-', icon: Icons.history),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _DetailRow({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 12, color: Colors.grey.shade400),
          const SizedBox(width: 8),
          Text('$label:', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              value, 
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final bool disabled;
  const _StatusChip({required this.disabled});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, py: 2),
      decoration: BoxDecoration(
        color: disabled ? Colors.red.shade50 : Colors.green.shade50,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: disabled ? Colors.red.shade200 : Colors.green.shade200),
      ),
      child: Text(
        disabled ? 'OFFLINE' : 'ONLINE',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: disabled ? Colors.red.shade700 : Colors.green.shade700,
        ),
      ),
    );
  }
}
