import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/invoice_provider.dart';
import '../providers/work_provider.dart';
import '../providers/auth_provider.dart';
import '../models/invoice.dart';
import '../models/server.dart';
import '../models/sub_area.dart';
import '../constants.dart';

class InvoiceScreen extends StatefulWidget {
  const InvoiceScreen({super.key});

  @override
  State<InvoiceScreen> createState() => _InvoiceScreenState();
}

class _InvoiceScreenState extends State<InvoiceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _selectedServerId;
  String? _selectedSubAreaId;
  final TextEditingController _searchController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_handleTabChange);
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchInvoices();
    });
  }

  void _handleTabChange() {
    if (_tabController.indexIsChanging) return;
    _fetchInvoices();
  }

  void _fetchInvoices() {
    final status = _tabController.index == 0 ? 'UNPAID' : 'PAID';
    Provider.of<InvoiceProvider>(context, listen: false).fetchInvoices(
      status: status,
      serverId: _selectedServerId,
      subAreaId: _selectedSubAreaId,
      search: _searchController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final workProvider = Provider.of<WorkProvider>(context);
    final invoiceProvider = Provider.of<InvoiceProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoices'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'UNPAID'),
            Tab(text: 'PAID'),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildFilterBar(workProvider),
          Expanded(
            child: invoiceProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : _buildInvoiceList(invoiceProvider.invoices, auth),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(WorkProvider work) {
    return Container(
      padding: const EdgeInsets.all(12),
      color: Colors.white,
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedServerId,
                  decoration: const InputDecoration(
                    labelText: 'Server',
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All Servers')),
                    ...work.servers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))),
                  ],
                  onChanged: (val) {
                    setState(() => _selectedServerId = val);
                    _fetchInvoices();
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedSubAreaId,
                  decoration: const InputDecoration(
                    labelText: 'Sub Area',
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All Areas')),
                    ...work.subAreas.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))),
                  ],
                  onChanged: (val) {
                    setState(() => _selectedSubAreaId = val);
                    _fetchInvoices();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search customer or username...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _searchController.clear();
                  _fetchInvoices();
                },
              ),
              border: const OutlineInputBorder(),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
            onSubmitted: (_) => _fetchInvoices(),
          ),
        ],
      ),
    );
  }

  Widget _buildInvoiceList(List<Invoice> invoices, AuthProvider auth) {
    if (invoices.isEmpty) {
      return const Center(child: Text('No invoices found.'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: invoices.length,
      itemBuilder: (context, index) {
        final inv = invoices[index];
        return Card(
          elevation: 2,
          margin: const EdgeInsets.only(bottom: 12),
          child: ExpansionTile(
            title: Text(inv.customer?.name ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${inv.period} - Rp ${inv.amount.toInt()}'),
            trailing: _StatusBadge(status: inv.status),
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _InfoRow(label: 'Username', value: inv.customer?.mikrotik_name ?? '-'),
                    _InfoRow(label: 'Due Date', value: inv.dueDate),
                    _InfoRow(label: 'Created At', value: inv.createdAt.split('T')[0]),
                    const Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton.icon(
                          onPressed: () => _showHistory(context, inv.id),
                          icon: const Icon(Icons.history),
                          label: const Text('History'),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () => _printThermal(inv.id, auth.user?.name ?? 'Admin'),
                          icon: const Icon(Icons.print),
                          label: const Text('Thermal'),
                        ),
                      ],
                    )
                  ],
                ),
              )
            ],
          ),
        );
      },
    );
  }

  Future<void> _printThermal(String id, String petugas) async {
    final baseUrl = AppConstants.defaultBaseUrl.replaceAll('/api', '');
    final url = Uri.parse('$baseUrl/api/billing/invoices/$id/thermal?petugas=${Uri.encodeComponent(petugas)}');
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not launch print URL')));
      }
    }
  }

  void _showHistory(BuildContext context, String id) {
     showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _HistoryBottomSheet(invoiceId: id),
    );
  }
}

class _HistoryBottomSheet extends StatelessWidget {
  final String invoiceId;
  const _HistoryBottomSheet({required this.invoiceId});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      height: MediaQuery.of(context).size.height * 0.5,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Invoice History', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Divider(),
          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: Provider.of<InvoiceProvider>(context, listen: false).fetchHistory(invoiceId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final history = snapshot.data ?? [];
                if (history.isEmpty) return const Center(child: Text('No history found.'));
                return ListView.builder(
                  itemCount: history.length,
                  itemBuilder: (context, index) {
                    final item = history[index];
                    return ListTile(
                      title: Text(item['action']),
                      subtitle: Text('${item['user_name']} - ${item['details'] ?? ''}'),
                      trailing: Text(item['timestamp'].toString().split('T')[0], style: const TextStyle(fontSize: 10)),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color = Colors.grey;
    if (status == 'PAID') color = Colors.green;
    if (status == 'UNPAID') color = Colors.amber;
    if (status == 'CANCELLED' || status == 'INVALID') color = Colors.red;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
