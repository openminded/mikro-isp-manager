import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/customer.dart';
import '../../providers/customer_provider.dart';
import '../../providers/auth_provider.dart';

class CustomerDetailScreen extends StatefulWidget {
  final Customer customer;

  const CustomerDetailScreen({super.key, required this.customer});

  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> {
  bool _isProcessing = false;

  Future<void> _toggleStatus() async {
     final action = widget.customer.disabled ? 'Unblock' : 'Block';
     final confirm = await showDialog(
       context: context, 
       builder: (ctx) => AlertDialog(
         title: Text('$action Customer?'),
         content: Text('Are you sure you want to ${action.toLowerCase()} this customer?'),
         actions: [
           TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
           TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
         ],
       )
     );
     
     if (confirm == true) {
        setState(() => _isProcessing = true);
        try {
            await Provider.of<CustomerProvider>(context, listen: false).toggleStatus(
                widget.customer.id, 
                widget.customer.disabled,
                serverId: widget.customer.serverId,
                name: widget.customer.name
            );
            
            if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Customer ${action}ed')));
                Navigator.pop(context); // Go back to refresh list
            }
        } catch (e) {
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
        } finally {
            if (mounted) setState(() => _isProcessing = false);
        }
     }
  }

  void _showEditDialog() {
       final nameController = TextEditingController(text: widget.customer.realName ?? widget.customer.name);
       final whatsappController = TextEditingController(text: widget.customer.whatsapp);
       final addressController = TextEditingController(text: widget.customer.address);
       final installationDateController = TextEditingController(text: widget.customer.installationDate);
       final ssidNameController = TextEditingController(text: widget.customer.ssidName);
       final ssidPasswordController = TextEditingController(text: widget.customer.ssidPassword);
       final signalLevelController = TextEditingController(text: widget.customer.signalLevel);
       
       showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
              title: const Text('Edit Customer'),
              content: SingleChildScrollView(
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Real Name')),
                          TextField(controller: whatsappController, decoration: const InputDecoration(labelText: 'WhatsApp')),
                          TextField(controller: addressController, decoration: const InputDecoration(labelText: 'Address')),
                          const Divider(height: 32),
                          const Align(
                              alignment: Alignment.centerLeft,
                              child: Text('Installation Details', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))
                          ),
                          TextField(controller: installationDateController, decoration: const InputDecoration(labelText: 'Installation Date (YYYY-MM-DD)')),
                          TextField(controller: ssidNameController, decoration: const InputDecoration(labelText: 'SSID Name')),
                          TextField(controller: ssidPasswordController, decoration: const InputDecoration(labelText: 'SSID Password')),
                          TextField(controller: signalLevelController, decoration: const InputDecoration(labelText: 'Redaman / Signal Level')),
                      ],
                  ),
              ),
              actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                  ElevatedButton(
                      onPressed: () async {
                          Navigator.pop(ctx);
                          setState(() => _isProcessing = true);
                          try {
                              await Provider.of<CustomerProvider>(context, listen: false).updateCustomer(
                                  widget.customer.id, 
                                  {
                                      'realName': nameController.text,
                                      'whatsapp': whatsappController.text,
                                      'address': addressController.text,
                                      'installationDate': installationDateController.text,
                                      'ssidName': ssidNameController.text,
                                      'ssidPassword': ssidPasswordController.text,
                                      'signalLevel': signalLevelController.text,
                                      'serverId': widget.customer.serverId,
                                      'name': widget.customer.name
                                  }
                              );
                              if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer Updated')));
                                  Navigator.pop(context);
                              }
                          } catch (e) {
                              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                          } finally {
                              if (mounted) setState(() => _isProcessing = false);
                          }
                      },
                      child: const Text('Save'),
                  )
              ],
          )
       );
  }

  @override
  Widget build(BuildContext context) {
    final customer = widget.customer;
    final user = Provider.of<AuthProvider>(context).user;
    final isAdmin = user?.role == 'admin' || user?.role == 'superadmin';
    
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
           crossAxisAlignment: CrossAxisAlignment.start,
           children: [
              Row(
                 mainAxisAlignment: MainAxisAlignment.spaceBetween,
                 children: [
                    Text(customer.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                    Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                            color: customer.disabled ? Colors.red.shade100 : Colors.green.shade100,
                            borderRadius: BorderRadius.circular(20)
                        ),
                        child: Text(
                            customer.disabled ? 'BLOCKED' : 'ACTIVE',
                            style: TextStyle(
                                color: customer.disabled ? Colors.red : Colors.green, 
                                fontWeight: FontWeight.bold
                            )
                        ),
                    )
                 ],
              ),
              const SizedBox(height: 24),
              _buildSection('Profile Info', [
                 _buildRow('Real Name', customer.realName ?? '-'),
                 _buildRow('Server', customer.serverName),
                 _buildRow('Profile', customer.profile),
                 _buildRow('IP Address', customer.remoteAddress ?? '-'),
              ]),
              const SizedBox(height: 24),
              _buildSection('Contact Info', [
                 _buildRow('WhatsApp', customer.whatsapp ?? '-'),
                 _buildRow('Address', customer.address ?? '-'),
              ]),
              const SizedBox(height: 24),
              _buildSection('Setup & Installation', [
                 _buildRow('Install Date', customer.installationDate ?? '-'),
                 _buildRow('Signal/Redaman', customer.signalLevel ?? '-'),
                 _buildRow('SSID Name', customer.ssidName ?? '-'),
                 _buildRow('SSID Password', customer.ssidPassword ?? '-'),
              ]),
              
              if (isAdmin) ...[
                  const SizedBox(height: 32),
                  SizedBox(
                     width: double.infinity,
                     child: ElevatedButton.icon(
                        onPressed: _isProcessing ? null : _showEditDialog,
                        icon: const Icon(Icons.edit),
                        label: const Text('Edit Details'),
                        style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
                     ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                     width: double.infinity,
                     child: OutlinedButton.icon(
                        onPressed: _isProcessing ? null : _toggleStatus,
                        icon: Icon(customer.disabled ? Icons.check_circle : Icons.block, color: customer.disabled ? Colors.green : Colors.red),
                        label: Text(customer.disabled ? 'Unblock Customer' : 'Block Customer', 
                            style: TextStyle(color: customer.disabled ? Colors.green : Colors.red)),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(16)),
                     ),
                  ),
              ],
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
