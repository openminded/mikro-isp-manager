import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/work_provider.dart';
import '../../models/registration.dart';

class RegistrationFormScreen extends StatefulWidget {
  final Registration? registration; // Optional for edit mode

  const RegistrationFormScreen({super.key, this.registration});

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
  String? _selectedSubAreaId;
  bool _isProcessing = false;

  bool get isEdit => widget.registration != null;

  @override
  void initState() {
    super.initState();
    
    if (isEdit) {
      final reg = widget.registration!;
      _phoneController.text = reg.phoneNumber;
      _nameController.text = reg.fullName;
      _addressController.text = reg.address;
      _mapsController.text = reg.mapsUrl ?? '';
      _selectedServerId = reg.locationId;
      _selectedSubAreaId = reg.subAreaId;
      // KTP might not be in the model? Let's check. 
      // Based on previous view_file of Registration model, KTP is not there.
      // But it is in the createRegistration data. 
    }

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
          // Simple validation/normalization for Indonesia
          if (phone.startsWith('0')) phone = '62${phone.substring(1)}';
          if (phone.isNotEmpty && !phone.startsWith('62')) phone = '62$phone';

          final data = {
              'phoneNumber': phone,
              'fullName': _nameController.text,
              'ktpNumber': _ktpController.text,
              'address': _addressController.text,
              'mapsUrl': _mapsController.text,
              'locationId': _selectedServerId,
              'sub_area_id': _selectedSubAreaId,
          };

          final provider = Provider.of<WorkProvider>(context, listen: false);
          if (isEdit) {
            await provider.updateRegistration(widget.registration!.id, data);
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Registration Updated')));
          } else {
            await provider.createRegistration(data);
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Registration Created')));
          }
          
          if (mounted) {
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
    final workProvider = Provider.of<WorkProvider>(context);
    final servers = workProvider.servers;
    final subAreas = workProvider.subAreas;

    return Scaffold(
      appBar: AppBar(title: Text(isEdit ? 'Edit Registration' : 'New Registration')),
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
                                    value: s.name, 
                                    child: Text(s.name)
                                )).toList(),
                                onChanged: (val) => setState(() {
                                    _selectedServerId = val;
                                    _selectedSubAreaId = null;
                                }),
                            ),
                        ),
                    ),
                    
                    if (_selectedServerId != null) ...[
                        const SizedBox(height: 16),
                        const Text('Sub Area', style: TextStyle(fontWeight: FontWeight.bold)),
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
                                    hint: const Text('Select Sub Area'),
                                    value: _selectedSubAreaId,
                                    items: subAreas.where((sa) {
                                        final server = servers.firstWhere((s) => s.name == _selectedServerId, orElse: () => servers.first); 
                                        return sa.serverId == server.id;
                                    }).map((sa) => DropdownMenuItem(
                                        value: sa.id,
                                        child: Text(sa.name)
                                    )).toList(),
                                    onChanged: (val) => setState(() => _selectedSubAreaId = val),
                                ),
                            ),
                        ),
                    ],
                    
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
                                : Text(isEdit ? 'Update Registration' : 'Create Registration', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
