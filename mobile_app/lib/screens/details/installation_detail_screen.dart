import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/work_item.dart';
import '../../providers/work_provider.dart';
import '../../widgets/status_badge.dart';

class InstallationDetailScreen extends StatefulWidget {
  final WorkItem item;

  const InstallationDetailScreen({super.key, required this.item});

  @override
  State<InstallationDetailScreen> createState() => _InstallationDetailScreenState();
}

class _InstallationDetailScreenState extends State<InstallationDetailScreen> {
  final _noteController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  void _handleStatusChange(String action, String defaultNote) async {
    final note = _noteController.text.isNotEmpty ? _noteController.text : defaultNote;
    setState(() => _isLoading = true);
    try {
        await Provider.of<WorkProvider>(context, listen: false).updateInstallationStatus(widget.item.id, action, note);
        if(!mounted) return;
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Status Updated')));
    } catch(e) {
        if(!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
        if(mounted) setState(() => _isLoading = false);
    }
  }

  void _showCompleteDialog() async {
      setState(() => _isLoading = true);
      final provider = Provider.of<WorkProvider>(context, listen: false);
      List<dynamic> secrets = [];
      try {
          secrets = await provider.fetchSecrets(widget.item.server);
      } catch (e) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to fetch secrets')));
          setState(() => _isLoading = false);
          return;
      }
      setState(() => _isLoading = false);

      if (!mounted) return;

      String? selectedSecretId;

      showDialog(
          context: context,
          builder: (ctx) => StatefulBuilder(
              builder: (context, setState) => AlertDialog(
                  title: const Text('Complete Installation'),
                  content: SizedBox(
                      width: double.maxFinite,
                      child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                              const Text('Select PPPoE Secret to bind:'),
                              const SizedBox(height: 12),
                              if (secrets.isEmpty)
                                  const Text('No secrets found on router.', style: TextStyle(color: Colors.red)),
                              if (secrets.isNotEmpty)
                                  DropdownButton<String>(
                                      isExpanded: true,
                                      value: selectedSecretId,
                                      hint: const Text('Select Account'),
                                      items: secrets.map((s) => DropdownMenuItem<String>(
                                          value: s['.id'],
                                          child: Text(s['name'] ?? 'Unknown'),
                                      )).toList(),
                                      onChanged: (val) => setState(() => selectedSecretId = val),
                                  )
                          ],
                      ),
                  ),
                  actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                      ElevatedButton(
                          onPressed: selectedSecretId == null ? null : () async {
                              Navigator.pop(ctx); // Close dialog
                              _performCompletion(selectedSecretId!);
                          },
                          child: const Text('Confirm Binding'),
                      )
                  ],
              ),
          )
      );
  }

  void _performCompletion(String secretId) async {
     setState(() => _isLoading = true);
     try {
         await Provider.of<WorkProvider>(context, listen: false).completeInstallation(widget.item.id, secretId, widget.item.server);
         if(!mounted) return;
         Navigator.pop(context);
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Installation Completed!')));
     } catch(e) {
         if(!mounted) return;
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
     } finally {
         if(mounted) setState(() => _isLoading = false);
     }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Installation Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
             _buildInfoSection(),
             const SizedBox(height: 24),
             const Text('Update Status', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
             const SizedBox(height: 12),
             TextField(
                controller: _noteController,
                decoration: const InputDecoration(
                    labelText: 'Notes (Optional)',
                    border: OutlineInputBorder()
                ),
                maxLines: 3,
             ),
             const SizedBox(height: 16),
             Row(
                children: [
                    Expanded(
                        child: OutlinedButton(
                            onPressed: _isLoading ? null : () => _handleStatusChange('cancel', 'Cancelled by tech'),
                            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                            child: const Text('Cancel Job'),
                        )
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                        child: ElevatedButton(
                            onPressed: _isLoading ? null : () => _handleStatusChange('pending', 'Started process'),
                            child: const Text('On Process'),
                        )
                    ),
                ],
             ),
             const SizedBox(height: 12),
             SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _showCompleteDialog,
                    icon: const Icon(Icons.check_circle),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12)
                    ),
                    label: const Text('Complete Installation'),
                ),
             )
          ],
        ),
      ),
    );
  }

  Widget _buildInfoSection() {
     return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    StatusBadge(status: widget.item.status, label: widget.item.rawStatus),
                    Text(widget.item.date, style: const TextStyle(color: Colors.grey)),
                ]),
                const SizedBox(height: 12),
                Text(widget.item.customerName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                _rowIcon(Icons.phone, widget.item.phoneNumber),
                _rowIcon(Icons.location_on, widget.item.address),
                _rowIcon(Icons.router, widget.item.server),
                if (widget.item.note != null) ...[
                    const SizedBox(height: 12),
                    Text('Note: ${widget.item.note}', style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.amber)),
                ]
            ],
        ),
     );
  }

  Widget _rowIcon(IconData icon, String text) {
      return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [Icon(icon, size: 16, color: Colors.grey), const SizedBox(width: 8), Text(text)]),
      );
  }
}
