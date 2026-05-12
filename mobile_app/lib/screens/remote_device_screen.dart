import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/remote_device.dart';
import '../providers/work_provider.dart';
import 'package:url_launcher/url_launcher.dart';

class RemoteDeviceScreen extends StatefulWidget {
  const RemoteDeviceScreen({super.key});

  @override
  State<RemoteDeviceScreen> createState() => _RemoteDeviceScreenState();
}

class _RemoteDeviceScreenState extends State<RemoteDeviceScreen> {
  List<RemoteDevice> _devices = [];
  bool _isLoading = false;
  String _searchQuery = '';
  String? _selectedServerId;

  @override
  void initState() {
    super.initState();
    _fetchDevices();
  }

  Future<void> _fetchDevices() async {
    setState(() => _isLoading = true);
    try {
      final api = ApiService();
      // We fetch all rules from DB first
      final String endpoint = _selectedServerId != null 
          ? '/mikrotik/nat?serverId=$_selectedServerId' 
          : '/mikrotik/nat';
      
      final List<dynamic> data = await api.get(endpoint);
      
      setState(() {
        _devices = data
            .map((json) => RemoteDevice.fromJson(json))
            .where((device) {
              // Rule 1: Must contain "onu" (case-insensitive) per user request
              final hasOnu = device.comment.toLowerCase().contains('onu');
              if (!hasOnu) return false;

              // Rule 2: Search filter
              if (_searchQuery.isNotEmpty) {
                final query = _searchQuery.toLowerCase();
                return device.comment.toLowerCase().contains(query) || 
                       device.toAddress.contains(query) || 
                       device.dstPort.contains(query);
              }
              return true;
            })
            .toList();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load devices: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _launchUrl(String url) async {
    if (!await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)) {
      throw Exception('Could not launch $url');
    }
  }

  Future<void> _showEditDialog(RemoteDevice device) async {
    final commentController = TextEditingController(text: device.comment);
    final dstPortController = TextEditingController(text: device.dstPort);
    final toAddressController = TextEditingController(text: device.toAddress);
    final toPortsController = TextEditingController(text: device.toPorts);

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Remote ONU', style: TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: commentController,
                decoration: const InputDecoration(labelText: 'Name / Comment', hintText: 'e.g. ONU-1-Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dstPortController,
                decoration: const InputDecoration(labelText: 'Public Port (dst-port)', hintText: 'e.g. 8081'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: toAddressController,
                decoration: const InputDecoration(labelText: 'Internal IP (to-address)', hintText: 'e.g. 192.168.1.1'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: toPortsController,
                decoration: const InputDecoration(labelText: 'Internal Port (to-ports)', hintText: 'e.g. 80'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
            child: const Text('Update'),
          ),
        ],
      ),
    );

    if (result == true) {
      await _updateDevice(device, {
        'comment': commentController.text,
        'dstPort': dstPortController.text,
        'toAddress': toAddressController.text,
        'toPorts': toPortsController.text,
      });
    }
  }

  Future<void> _updateDevice(RemoteDevice device, Map<String, dynamic> data) async {
    setState(() => _isLoading = true);
    try {
      final api = ApiService();
      await api.put('/mikrotik/nat', {
        'serverId': device.serverId,
        'id': device.id,
        ...data,
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Device updated successfully')));
      _fetchDevices();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update device: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final work = Provider.of<WorkProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Remote', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
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
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              children: [
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search ONU name or IP...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: Colors.grey.shade100,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (val) {
                    setState(() => _searchQuery = val);
                    _fetchDevices();
                  },
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedServerId,
                      hint: const Text('All Servers'),
                      isExpanded: true,
                      items: [
                        const DropdownMenuItem(value: null, child: Text('All Servers')),
                        ...work.servers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))),
                      ],
                      onChanged: (val) {
                        setState(() => _selectedServerId = val);
                        _fetchDevices();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),

          // List
          Expanded(
            child: _isLoading && _devices.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _fetchDevices,
                    child: _devices.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.monitor_heart_outlined, size: 64, color: Colors.grey.shade300),
                                const SizedBox(height: 16),
                                Text(
                                  'No ONU devices found',
                                  style: TextStyle(color: Colors.grey.shade500, fontSize: 16),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _devices.length,
                            itemBuilder: (context, index) {
                              final device = _devices[index];
                              final server = work.servers.firstWhere((s) => s.id == device.serverId, orElse: () => work.servers[0]);
                              
                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                elevation: 2,
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.blue.shade50,
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: const Icon(Icons.router, color: Colors.blue, size: 20),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  device.comment,
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                                  maxLines: 2,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                                Text(
                                                  server.name,
                                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                                                ),
                                              ],
                                            ),
                                          ),
                                          _StatusChip(status: device.lastCheckStatus),
                                          const SizedBox(width: 8),
                                          IconButton(
                                            onPressed: () => _showEditDialog(device),
                                            icon: const Icon(Icons.edit, size: 20, color: Colors.blue),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(),
                                          ),
                                        ],
                                      ),
                                      const Divider(height: 24),
                                      _InfoRow(
                                        icon: Icons.link,
                                        label: 'Public Access',
                                        value: '${server.ip}:${device.dstPort}',
                                        isLink: true,
                                        onTap: () => _launchUrl('http://${server.ip}:${device.dstPort}'),
                                      ),
                                      const SizedBox(height: 8),
                                      _InfoRow(
                                        icon: Icons.lan_outlined,
                                        label: 'Internal IP',
                                        value: '${device.toAddress}:${device.toPorts}',
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isLink;
  final VoidCallback? onTap;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLink = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade400),
        const SizedBox(width: 8),
        Text('$label: ', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
        Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isLink ? Colors.blue : Colors.black87,
                decoration: isLink ? TextDecoration.underline : null,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String? status;
  const _StatusChip({this.status});

  @override
  Widget build(BuildContext context) {
    final bool isOnline = status == 'online';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isOnline ? Colors.green.shade50 : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: isOnline ? Colors.green.shade200 : Colors.grey.shade300),
      ),
      child: Text(
        isOnline ? 'ONLINE' : 'UNKNOWN',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: isOnline ? Colors.green.shade700 : Colors.grey.shade600,
        ),
      ),
    );
  }
}
