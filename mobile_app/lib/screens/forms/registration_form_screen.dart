import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';

class RegistrationFormScreen extends StatefulWidget {
  const RegistrationFormScreen({super.key});

  @override
  State<RegistrationFormScreen> createState() => _RegistrationFormScreenState();
}

class _RegistrationFormScreenState extends State<RegistrationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Controllers
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _ktpController = TextEditingController();
  final _addressController = TextEditingController();
  final _mapsController = TextEditingController();
  
  String? _selectedServerId;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    // Ensure servers are loaded
    Future.microtask(() => 
       Provider.of<WorkProvider>(context, listen: false).refreshData(null)
    );
  }

  Future<void> _submit() async {
      if (!_formKey.currentState!.validate()) return;
      if (_selectedServerId == null) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a location/server')));
          return;
      }

      setState(() => _isProcessing = true);
      
      try {
          // Normalize Phone
          String phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
          if (phone.startsWith('0')) phone = '62${phone.substring(1)}';
          if (!phone.startsWith('62')) phone = '62$phone';

          final data = {
              'phoneNumber': phone,
              'fullName': _nameController.text,
              'ktpNumber': _ktpController.text,
              'address': _addressController.text,
              'mapsUrl': _mapsController.text,
              'locationId': _selectedServerId, // This should be server name usually for registration as per current schema, checking Dropdown values below
          };

          await Provider.of<WorkProvider>(context, listen: false).createRegistration(data);
          
          if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Registration Created')));
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

    return Scaffold(
      appBar: AppBar(title: const Text('New Registration')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
            key: _formKey,
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                    _buildTextField(
                        controller: _phoneController, 
                        label: 'Phone Number', 
                        hint: '81234567890', 
                        keyboardType: TextInputType.phone,
                        required: true
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _nameController, 
                        label: 'Full Name', 
                        required: true
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _addressController, 
                        label: 'Address', 
                        maxLines: 3
                    ),
                    const SizedBox(height: 16),
                    
                    // Server Dropdown
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
                                    value: s.name, // Using Name as value because Registration model uses locationId as string name usually
                                    child: Text(s.name)
                                )).toList(),
                                onChanged: (val) => setState(() => _selectedServerId = val),
                            ),
                        ),
                    ),
                    
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _ktpController, 
                        label: 'KTP Number', 
                        keyboardType: TextInputType.number
                    ),
                    const SizedBox(height: 16),
                    _buildTextField(
                        controller: _mapsController, 
                        label: 'Maps URL (Optional)',
                        keyboardType: TextInputType.url
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
                                : const Text('Create Registration', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
