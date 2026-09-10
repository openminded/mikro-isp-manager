import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/work_provider.dart';
import '../services/api_service.dart';

class BlockedUserScreen extends StatefulWidget {
  const BlockedUserScreen({super.key});

  @override
  State<BlockedUserScreen> createState() => _BlockedUserScreenState();
}

class _BlockedUserScreenState extends State<BlockedUserScreen> {
  String? _selectedServerId;
  bool _isLoading = false;
  List<dynamic> _blockedUsers = [];
  String? _error;
  bool _hasSearched = false;

  Future<void> _loadData() async {
    if (_selectedServerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a server first')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
      _blockedUsers = [];
      _hasSearched = true;
    });

    try {
      final workProvider = Provider.of<WorkProvider>(context, listen: false);
      final server = workProvider.servers.firstWhere((s) => s.id == _selectedServerId);

      final serverData = {
        'id': server.id,
        'name': server.name,
        'ip': server.ip,
        'username': server.username,
        'password': server.password,
        'port': server.port,
      };

      final response = await ApiService().post('/mikrotik/sync', {
        'server': serverData,
        'resource': 'secrets'
      });

      if (response != null && response['data'] is List) {
        final List<dynamic> allUsers = response['data'];
        final blocked = allUsers.where((item) {
          final disabled = item['disabled'];
          return disabled == 'true' || disabled == true;
        }).toList();

        setState(() {
          _blockedUsers = blocked;
        });
      } else {
         throw Exception('Invalid response format');
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final workProvider = Provider.of<WorkProvider>(context);
    final servers = workProvider.servers;

    // Ensure _selectedServerId is valid
    if (_selectedServerId != null && !servers.any((s) => s.id == _selectedServerId)) {
      _selectedServerId = null;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Blocked Users'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: const InputDecoration(
                      labelText: 'Select Server',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                    value: _selectedServerId,
                    items: servers.map((s) => DropdownMenuItem(
                      value: s.id,
                      child: Text(s.name),
                    )).toList(),
                    onChanged: (val) {
                      setState(() {
                        _selectedServerId = val;
                        _hasSearched = false;
                      });
                    },
                  ),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _loadData,
                  icon: _isLoading 
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) 
                      : const Icon(Icons.download),
                  label: const Text('Load Data'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_isLoading)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Expanded(child: Center(child: Text('Error: $_error', style: const TextStyle(color: Colors.red))))
            else if (_blockedUsers.isEmpty && _hasSearched)
              const Expanded(child: Center(child: Text('No blocked users found.')))
            else if (!_hasSearched)
              const Expanded(child: Center(child: Text('Select server and press Load Data', style: TextStyle(color: Colors.grey))))
            else
              Expanded(
                child: ListView.builder(
                  itemCount: _blockedUsers.length,
                  itemBuilder: (context, index) {
                    final user = _blockedUsers[index];
                    final name = user['name'] ?? 'Unknown';
                    final profile = user['profile'] ?? '-';
                    final comment = user['comment'] ?? user['realName'] ?? '';
                    final address = user['address'] ?? '';

                    String subtitleStr = 'Profile: $profile';
                    if (comment.toString().isNotEmpty) {
                      subtitleStr += '\nInfo: $comment';
                    }
                    if (address.toString().isNotEmpty) {
                      subtitleStr += '\nAlamat: $address';
                    }

                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Colors.redAccent,
                          child: Icon(Icons.block, color: Colors.white),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(subtitleStr),
                        isThreeLine: subtitleStr.contains('\n'),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
