import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../providers/customer_provider.dart';
import '../../models/customer.dart';
import '../../widgets/status_badge.dart';

class TicketFormScreen extends StatefulWidget {
  const TicketFormScreen({super.key});

  @override
  State<TicketFormScreen> createState() => _TicketFormScreenState();
}

class _TicketFormScreenState extends State<TicketFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Controllers
  final _customerNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _descriptionController = TextEditingController();
  
  String? _selectedServerId;
  String? _selectedDamageType;
  bool _isProcessing = false;

  final List<String> _damageTypes = ['LOS', 'Lambat', 'Putus-Putus', 'Pindah Rumah', 'Ganti Password', 'Lainnya'];

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
       Provider.of<WorkProvider>(context, listen: false).refreshData(null);
       Provider.of<CustomerProvider>(context, listen: false).fetchCustomers();
    });
  }

  Future<void> _submit() async {
      if (!_formKey.currentState!.validate()) return;
      if (_selectedServerId == null) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a location/server')));
          return;
      }
      if (_selectedDamageType == null) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a damage type')));
          return;
      }

      setState(() => _isProcessing = true);
      
      try {
          // Normalize Phone
          String phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
          if (phone.startsWith('0')) phone = '62${phone.substring(1)}';
          if (!phone.startsWith('62')) phone = '62$phone';

          final data = {
              'customerName': _customerNameController.text,
              'customerPhone': phone,
              'customerAddress': _addressController.text,
              'locationId': _selectedServerId, 
              'damageTypeName': _selectedDamageType,
              'description': _descriptionController.text,
              'status': 'open' // Default status
          };

          await Provider.of<WorkProvider>(context, listen: false).createTicket(data);
          
          if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket Created')));
              Navigator.pop(context);
          }
      } catch (e) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      } finally {
          if (mounted) setState(() => _isProcessing = false);
      }
  }

  @override
  Widget build(BuildContext context) {
    final servers = Provider.of<WorkProvider>(context).servers;
    final customers = Provider.of<CustomerProvider>(context).customers;
    
    // Filter customers based on selected server
    final serverCustomers = _selectedServerId == null 
        ? <Customer>[] 
        : customers.where((c) => c.serverId == _selectedServerId).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('New Support Ticket')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
            key: _formKey,
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                    // 1. Server Dropdown (FIRST)
                    const Text('Location (Server) *', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8)
                        ),
                        child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                                isExpanded: true,
                                hint: const Text('Select Location'),
                                value: _selectedServerId,
                                items: servers.map((s) => DropdownMenuItem(
                                    value: s.name, 
                                    child: Text(s.name) // Using name as ID for consistency
                                )).toList(),
                                onChanged: (val) {
                                    setState(() {
                                        _selectedServerId = val;
                                        // Reset customer selection if server changes
                                        _customerNameController.clear(); 
                                        _phoneController.clear();
                                        _addressController.clear();
                                    });
                                },
                            ),
                        ),
                    ),
                    const SizedBox(height: 16),

                    // 2. Customer Dropdown (Dependent on Server)
                    const Text('Customer *', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                     Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8)
                        ),
                        child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                                isExpanded: true,
                                hint: Text(_selectedServerId == null ? 'Select Location First' : 'Select Customer'),
                                value: _customerNameController.text.isNotEmpty && serverCustomers.any((c) => c.name == _customerNameController.text) 
                                    ? _customerNameController.text // Use name as value? Or ID? Logic uses Name currently.
                                    : null,
                                items: serverCustomers.map((c) => DropdownMenuItem(
                                    value: c.name, 
                                    child: Text('${c.name} (${c.profile})')
                                )).toList(),
                                onChanged: _selectedServerId == null ? null : (val) {
                                    if (val != null) {
                                        final customer = serverCustomers.firstWhere((c) => c.name == val);
                                        setState(() {
                                            _customerNameController.text = customer.name;
                                            // Auto-fill
                                            if (customer.whatsapp != null) _phoneController.text = customer.whatsapp!;
                                            if (customer.address != null) _addressController.text = customer.address!;
                                        });
                                    }
                                },
                            ),
                        ),
                    ),
                    
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _phoneController, 
                        label: 'Phone Number', 
                        hint: '81234567890', 
                        keyboardType: TextInputType.phone,
                        required: true
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _addressController, 
                        label: 'Address', 
                        maxLines: 2
                    ),
                    
                    const SizedBox(height: 16),
                    // Damage Type
                    const Text('Damage Type *', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                     Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8)
                        ),
                        child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                                isExpanded: true,
                                hint: const Text('Select Damage Type'),
                                value: _selectedDamageType,
                                items: _damageTypes.map((t) => DropdownMenuItem(
                                    value: t, 
                                    child: Text(t)
                                )).toList(),
                                onChanged: (val) => setState(() => _selectedDamageType = val),
                            ),
                        ),
                    ),

                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _descriptionController, 
                        label: 'Description / Complaint', 
                        maxLines: 4,
                        required: true
                    ),
                    
                    const SizedBox(height: 32),
                    SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                            onPressed: _isProcessing ? null : _submit,
                            style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                backgroundColor: Colors.blue,
                                foregroundColor: Colors.white
                            ),
                            child: _isProcessing 
                                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Text('Create Ticket', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                    )
                ],
            ),
        ),
      ),
    );
  }

  Widget _buildTextField({
      required TextEditingController controller, 
      required String label, 
      String? hint, 
      TextInputType? keyboardType, 
      int maxLines = 1,
      bool required = false
  }) {
      return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
              RichText(
                  text: TextSpan(
                      text: label,
                      style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                      children: [
                          if (required) const TextSpan(text: ' *', style: TextStyle(color: Colors.red))
                      ]
                  )
              ),
              const SizedBox(height: 8),
              TextFormField(
                  controller: controller,
                  keyboardType: keyboardType,
                  maxLines: maxLines,
                  validator: required ? (val) => val == null || val.isEmpty ? 'Required' : null : null,
                  decoration: InputDecoration(
                      hintText: hint,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12)
                  ),
              ),
          ],
      );
  }
}
