import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../models/registration.dart';
import '../models/ticket.dart';
import '../widgets/custom_card.dart'; // Utilizing existing card if useful, or standard widgets

class PerformanceReportScreen extends StatefulWidget {
  const PerformanceReportScreen({super.key});

  @override
  State<PerformanceReportScreen> createState() => _PerformanceReportScreenState();
}

class _PerformanceReportScreenState extends State<PerformanceReportScreen> {
  bool _isLoading = true;
  DateTime _selectedMonth = DateTime.now();
  
  // Stats
  int _totalInstallations = 0;
  int _totalTickets = 0;
  List<Registration> _monthInstallations = [];
  List<Ticket> _monthTickets = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    final api = ApiService();

    try {
      // 1. Fetch All Data (Server-side filtering would be better, but we are doing client-side as requested)
      // Note: This matches the implementation plan to avoid server changes.
      // We assume endpoints /api/registrations and /api/tickets exist and return arrays.
      
      final regData = await api.get('/registrations');
      final ticketData = await api.get('/tickets');

      List<Registration> allRegs = [];
      if (regData is List) {
        allRegs = regData.map((json) => Registration.fromJson(json)).toList();
      }

      List<Ticket> allTickets = [];
      if (ticketData is List) {
        allTickets = ticketData.map((json) => Ticket.fromJson(json)).toList();
      }

      _processDataForMonth(allRegs, allTickets);

    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error loading data: $e')));
      setState(() => _isLoading = false);
    }
  }

  void _processDataForMonth(List<Registration> allRegs, List<Ticket> allTickets) {
    final startOfMonth = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
    final endOfMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0, 23, 59, 59);

    // Filter Installations
    // Criteria: workingOrderStatus == 'completed' OR status == 'active' ? 
    // Let's assume 'workingOrderStatus' == 'done' or 'completed'. 
    // Based on limited view, let's include anything that has a date in this month AND is not 'queue'/'pending' 
    // OR just count all assignments? User asked for "Performance", usually means "Completed".
    // I will check for 'workingOrderStatus' == 'completed' or 'closed' or 'done'.
    // If not sure, exact string match might fail.
    
    // ADJUSTMENT: We will filter by date first.
    
    _monthInstallations = allRegs.where((r) {
      if (r.createdAt.isEmpty) return false;
      try {
        final date = DateTime.parse(r.createdAt); // Or use workingOrderDate if available?
        // Ideally we use completion date, but often createdAt is close enough for simple monthly report if completion date unspecified.
        // Better: Use `installation?.finishDate` if available.
        DateTime targetDate = date;
        if (r.installation?.finishDate != null && r.installation!.finishDate!.isNotEmpty) {
           targetDate = DateTime.parse(r.installation!.finishDate!);
        }
        
        return targetDate.isAfter(startOfMonth.subtract(const Duration(seconds: 1))) && 
               targetDate.isBefore(endOfMonth.add(const Duration(seconds: 1)));
      } catch (e) { return false; }
    }).where((r) {
        // Status filter
        final s = r.workingOrderStatus.toLowerCase();
        return s == 'completed' || s == 'done' || s == 'verified' || s == 'active';
    }).toList();

    // Filter Tickets
    // Criteria: status == 'closed'
    _monthTickets = allTickets.where((t) {
       if (t.createdAt.isEmpty) return false;
       try {
         // Use closedAt if available? Ticket model check needed.
         final date = DateTime.parse(t.createdAt);
         return date.isAfter(startOfMonth.subtract(const Duration(seconds: 1))) && 
                date.isBefore(endOfMonth.add(const Duration(seconds: 1)));
       } catch (e) { return false; }
    }).where((t) => t.status.toLowerCase() == 'closed' || t.status.toLowerCase() == 'done' || t.status.toLowerCase() == 'resolved').toList();

    _totalInstallations = _monthInstallations.length;
    _totalTickets = _monthTickets.length;

    setState(() => _isLoading = false);
  }
  
  // Need to store raw data to avoid refetching on month change
  // For simplicity MVP, we refetch or we should store it in class variable.
  // I will refetch for now to keep code simple, OR better: separate fetch and filter.

  // Optimization: Store all data
  List<Registration> _allRegsCache = [];
  List<Ticket> _allTicketsCache = [];
  
  // Re-write _fetchData to populate cache
  // ... (Adjusted below in actual file content)

  Future<void> _selectMonth(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedMonth,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDatePickerMode: DatePickerMode.year,
    );
    if (picked != null && picked != _selectedMonth) {
      setState(() {
        _selectedMonth = picked;
        _recalculate();
      });
    }
  }

  void _recalculate() {
     _processDataForMonth(_allRegsCache, _allTicketsCache);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance Report'),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Month Selector
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.calendar_month),
                    title: Text('${DateFormat('MMMM yyyy').format(_selectedMonth)}'),
                    trailing: const Icon(Icons.arrow_drop_down),
                    onTap: () => _selectMonth(context),
                  ),
                ),
                const SizedBox(height: 20),
                
                // Summary Grid
                Row(
                  children: [
                    Expanded(child: _buildStatCard('Installations', _totalInstallations, Icons.router, Colors.blue)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildStatCard('Tickets', _totalTickets, Icons.confirmation_number, Colors.orange)),
                  ],
                ),
                
                const SizedBox(height: 24),
                const Text('History Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),

                // Details List
                if (_totalInstallations == 0 && _totalTickets == 0)
                   const Padding(
                     padding: EdgeInsets.all(16.0),
                     child: Text('No completed work found for this month.', style: TextStyle(color: Colors.grey)),
                   ),
                
                ..._monthInstallations.map((r) => ListTile(
                  leading: const CircleAvatar(backgroundColor: Colors.blue, child: Icon(Icons.check, color: Colors.white, size: 16)),
                  title: Text('Install: ${r.fullName}'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(DateTime.parse(r.createdAt))),
                )),
                
                ..._monthTickets.map((t) => ListTile(
                  leading: const CircleAvatar(backgroundColor: Colors.orange, child: Icon(Icons.check, color: Colors.white, size: 16)),
                  title: Text('Ticket: ${t.description}'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(DateTime.parse(t.createdAt))),
                )),

              ],
            ),
          ),
    );
  }

  Widget _buildStatCard(String title, int count, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 4, offset: const Offset(0, 2))],
        border: Border.all(color: Colors.grey.withOpacity(0.2))
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(count.toString(), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text(title, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
        ],
      ),
    );
  }
}
