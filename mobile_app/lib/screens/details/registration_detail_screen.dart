import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/registration.dart';
import '../../providers/work_provider.dart';
import 'package:intl/intl.dart';
import '../forms/registration_form_screen.dart';

class RegistrationDetailScreen extends StatefulWidget {
  final Registration registration;

  const RegistrationDetailScreen({super.key, required this.registration});

  @override
  State<RegistrationDetailScreen> createState() => _RegistrationDetailScreenState();
}

class _RegistrationDetailScreenState extends State<RegistrationDetailScreen> {
  final _technicianController = TextEditingController();
  final _companionController = TextEditingController();
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  String? _selectedCostName;
  num? _selectedCostPrice;

  bool _isProcessing = false;

  void _showProcessDialog() {
    // Basic dialog to select technician/date
    // In a real app, this should probably be a bottom sheet with dropdowns for technicians
    // For now, simpler text fields or we can fetch employees if available
    
    // Get available costs
    final provider = Provider.of<WorkProvider>(context, listen: false);
    final servers = provider.servers;
    // Find server for this registration
    final server = servers.firstWhere(
        (s) => s.name == widget.registration.locationId || s.id == widget.registration.locationId, 
        orElse: () => servers.isNotEmpty ? servers.first : throw 'No servers loaded' // Fallback safety?
    );
    // Find costs
    // Note: server might throw if not found. But we should have servers loaded.
    // If not found, cost list is empty.
    
    // We need to properly import Server model if installationCosts is on it. 
    // Assuming WorkProvider exposes servers list properly.
    
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: const Text('Process Installation'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Technician'),
                  items: Provider.of<WorkProvider>(context, listen: false).technicians.map((t) => DropdownMenuItem(value: t.name, child: Text(t.name))).toList(),
                  onChanged: (val) => _technicianController.text = val ?? '',
                ),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: 'Companion (Optional)'),
                   items: [
                      const DropdownMenuItem(value: '', child: Text('None')),
                      ...Provider.of<WorkProvider>(context, listen: false).technicians.map((t) => DropdownMenuItem(value: t.name, child: Text(t.name)))
                   ],
                  onChanged: (val) => _companionController.text = val ?? '',
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                   decoration: const InputDecoration(labelText: 'Installation Cost'),
                   value: _selectedCostName,
                   items: [
                       const DropdownMenuItem(value: null, child: Text('None / Custom')),
                       ...server.installationCosts.map((c) => DropdownMenuItem(
                           value: c.name, 
                           child: Text('${c.name} - ${c.price}')
                        ))
                   ],
                   onChanged: (val) {
                       final cost = server.installationCosts.firstWhere((c) => c.name == val, orElse: () => server.installationCosts.first);
                       if (val != null) {
                           setState(() {
                               _selectedCostName = val;
                               _selectedCostPrice = cost.price;
                           });
                           // Also update parent state to persist across rebuilds if needed? 
                           // But here we just need it for the _processInstallation call which reads from main state vars?
                           // Actually _processInstallation reads `_selectedCostName`.
                           // So we MUST update the parent state too or use local vars for the action.
                           // Let's update `this.setState` (outer) too?
                           // Or just update outer variables directly since we are inside `StatefulBuilder`.
                           // Better: Update parent widgets state variables.
                           this.setState(() {
                              _selectedCostName = val;
                              _selectedCostPrice = cost.price;
                           });
                       } else {
                           this.setState(() {
                              _selectedCostName = null;
                              _selectedCostPrice = null;
                           });
                       }
                   },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () async {
                          final date = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime(2030), initialDate: _selectedDate);
                          if (date != null) {
                              setState(() => _selectedDate = date);
                              this.setState(() => _selectedDate = date);
                          }
                        },
                        child: Text(DateFormat('yyyy-MM-dd').format(_selectedDate)),
                      ),
                    ),
                    Expanded(
                      child: TextButton(
                        onPressed: () async {
                          final time = await showTimePicker(context: context, initialTime: _selectedTime);
                          if (time != null) {
                              setState(() => _selectedTime = time);
                              this.setState(() => _selectedTime = time);
                          }
                        },
                        child: Text(_selectedTime.format(context)),
                      ),
                    ),
                  ],
                )
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () {
                   Navigator.pop(ctx);
                   _processInstallation();
                },
                child: const Text('Confirm'),
              ),
            ],
          );
        }
      ),
    );
  }

  Future<void> _processInstallation() async {
    setState(() => _isProcessing = true);
    final provider = Provider.of<WorkProvider>(context, listen: false);
    
    try {
      final dateStr = DateTime(
        _selectedDate.year, _selectedDate.month, _selectedDate.day, 
        _selectedTime.hour, _selectedTime.minute
      ).toIso8601String();
      
      await provider.processInstallation(
        widget.registration.id, 
        _technicianController.text, 
        _companionController.text, 
        dateStr,
        cost: _selectedCostName != null ? {'name': _selectedCostName, 'price': _selectedCostPrice} : null
      );

      
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Installation Scheduled')));
         // Ideally refresh or navigate back
         await provider.refreshData(null); // refresh all?
         Navigator.pop(context); 
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _cancelRegistration() async {
     final confirm = await showDialog(
       context: context, 
       builder: (ctx) => AlertDialog(
         title: const Text('Cancel Registration?'),
         content: const Text('This action cannot be undone immediately.'),
         actions: [
           TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
           TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes')),
         ],
       )
     );
     
     if (confirm == true) {
        setState(() => _isProcessing = true);
        try {
            await Provider.of<WorkProvider>(context, listen: false).cancelRegistration(widget.registration.id);
            if (mounted) Navigator.pop(context);
        } catch (e) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        } finally {
            if (mounted) setState(() => _isProcessing = false);
        }
     }
  }

  @override
  Widget build(BuildContext context) {
    final reg = widget.registration;
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Registration Details'),
        actions: [
          if (reg.status != 'done')
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => RegistrationFormScreen(registration: reg),
                  ),
                );
              },
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
           crossAxisAlignment: CrossAxisAlignment.start,
           children: [
              _buildSection('Customer Info', [
                 _buildRow('Name', reg.fullName),
                 _buildRow('Phone', reg.phoneNumber),
                 _buildRow('Address', reg.address),
                 _buildRow('Maps', reg.mapsUrl ?? '-'),
              ]),
              const SizedBox(height: 24),
              _buildSection('Status', [
                 _buildRow('Status', reg.status),
                 _buildRow('Registration Date', reg.createdAt),
                 if (reg.installation?.cost != null)
                    _buildRow('Installation Cost', '${reg.installation!.cost!.name} (Rp ${reg.installation!.cost!.price})'),
              ]),
              
              const SizedBox(height: 32),
              
              if (reg.status == 'queue') ...[
                 SizedBox(
                   width: double.infinity,
                   child: ElevatedButton.icon(
                      onPressed: _isProcessing ? null : _showProcessDialog,
                      icon: const Icon(Icons.build),
                      label: const Text('Process Installation'),
                      style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
                   ),
                 ),
                 const SizedBox(height: 12),
                 SizedBox(
                   width: double.infinity,
                   child: OutlinedButton.icon(
                      onPressed: _isProcessing ? null : _cancelRegistration,
                      icon: const Icon(Icons.cancel, color: Colors.red),
                      label: const Text('Cancel Registration', style: TextStyle(color: Colors.red)),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(16)),
                   ),
                 ),
              ]
           ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
     return Column(
       crossAxisAlignment: CrossAxisAlignment.start,
       children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Divider(),
          ...children
       ],
     );
  }

  Widget _buildRow(String label, String value) {
     return Padding(
       padding: const EdgeInsets.symmetric(vertical: 4),
       child: Row(
         crossAxisAlignment: CrossAxisAlignment.start,
         children: [
            SizedBox(width: 120, child: Text(label, style: const TextStyle(color: Colors.grey))),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
         ],
       ),
     );
  }
}
