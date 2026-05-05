import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/work_provider.dart';
import '../providers/auth_provider.dart';

class ChangeOnuScreen extends StatefulWidget {
  const ChangeOnuScreen({super.key});

  @override
  State<ChangeOnuScreen> createState() => _ChangeOnuScreenState();
}

class _ChangeOnuScreenState extends State<ChangeOnuScreen> {
  String? _selectedServerId;
  List<dynamic> _secrets = [];
  bool _isLoadingSecrets = false;
  
  String? _oldUsername;
  String? _newUsername;
  bool _isSubmitting = false;

  String _searchOld = '';
  String _searchNew = '';

  Future<void> _fetchSecrets() async {
    if (_selectedServerId == null) return;
    setState(() => _isLoadingSecrets = true);
    try {
      final api = ApiService();
      final List<dynamic> data = await api.get('/mikrotik/secrets/$_selectedServerId');
      setState(() => _secrets = data);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load secrets: $e')),
      );
    } finally {
      setState(() => _isLoadingSecrets = false);
    }
  }

  Future<void> _showEditSecretDialog(dynamic secret) async {
    final commentController = TextEditingController(text: secret['comment'] ?? '');
    final passwordController = TextEditingController(text: secret['password'] ?? '');

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit Secret: ${secret['name']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: commentController,
              decoration: const InputDecoration(labelText: 'Comment'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: passwordController,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (result == true) {
      await _updateSecret(secret['name'], commentController.text, passwordController.text);
    }
  }

  Future<void> _updateSecret(String name, String comment, String password) async {
    setState(() => _isSubmitting = true);
    try {
      final api = ApiService();
      await api.put('/mikrotik/secrets', {
        'serverId': _selectedServerId,
        'name': name,
        'comment': comment,
        'password': password,
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Secret updated successfully')));
      _fetchSecrets();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update secret: $e')));
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitChange() async {
    if (_selectedServerId == null || _oldUsername == null || _newUsername == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select server and both accounts')),
      );
      return;
    }

    if (_oldUsername == _newUsername) {
       ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Old and New username cannot be the same')),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Change'),
        content: Text('Are you sure you want to change ONU from $_oldUsername to $_newUsername?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Change')),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSubmitting = true);
    try {
      final api = ApiService();
      final auth = Provider.of<AuthProvider>(context, listen: false);
      
      final res = await api.post('/mikrotik/change-onu', {
        'serverId': _selectedServerId,
        'oldUsername': _oldUsername,
        'newUsername': _newUsername,
        'user': {
            'username': auth.user?.username ?? 'Unknown'
        }
      });

      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ONU changed successfully!')),
        );
        setState(() {
          _oldUsername = null;
          _newUsername = null;
          _searchOld = '';
          _searchNew = '';
        });
        _fetchSecrets(); // Refresh list
      } else {
        throw Exception(res['error'] ?? 'Unknown error');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to change ONU: $e')),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  List<dynamic> _getFilteredSecrets(String query) {
    if (query.isEmpty) return _secrets;
    final q = query.toLowerCase();
    return _secrets.where((s) {
      final name = (s['name'] ?? '').toString().toLowerCase();
      final comment = (s['comment'] ?? '').toString().toLowerCase();
      final ip = (s['remote-address'] ?? '').toString().toLowerCase();
      return name.contains(q) || comment.contains(q) || ip.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final work = Provider.of<WorkProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Change ONU', style: TextStyle(fontWeight: FontWeight.bold)),
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
          // Server Selection
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
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedServerId,
                  hint: const Text('Select Server'),
                  isExpanded: true,
                  items: work.servers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedServerId = val;
                      _oldUsername = null;
                      _newUsername = null;
                    });
                    _fetchSecrets();
                  },
                ),
              ),
            ),
          ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildSectionHeader('SOURCE DEVICE (OLD)'),
                  const SizedBox(height: 8),
                  _buildSecretSelector(
                    label: 'Select Old PPP Secret',
                    currentValue: _oldUsername,
                    onSelected: (val) => setState(() => _oldUsername = val),
                    onSearch: (val) => setState(() => _searchOld = val),
                    query: _searchOld,
                    isOld: true,
                  ),
                  
                  const SizedBox(height: 24),
                  const Center(child: Icon(Icons.arrow_downward, color: Colors.grey)),
                  const SizedBox(height: 24),

                  _buildSectionHeader('TARGET DEVICE (NEW)'),
                  const SizedBox(height: 8),
                  _buildSecretSelector(
                    label: 'Select New PPP Secret',
                    currentValue: _newUsername,
                    onSelected: (val) => setState(() => _newUsername = val),
                    onSearch: (val) => setState(() => _searchNew = val),
                    query: _searchNew,
                    isOld: false,
                  ),

                  const SizedBox(height: 40),

                  ElevatedButton(
                    onPressed: _isSubmitting || _oldUsername == null || _newUsername == null ? null : _submitChange,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue.shade700,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      disabledBackgroundColor: Colors.grey.shade300,
                    ),
                    child: _isSubmitting 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('APPLY CHANGE ONU', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        color: Colors.grey.shade600,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _buildSecretSelector({
    required String label,
    required String? currentValue,
    required Function(String) onSelected,
    required Function(String) onSearch,
    required String query,
    required bool isOld,
  }) {
    final filtered = _getFilteredSecrets(query);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by name, comment or IP...',
                hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                prefixIcon: const Icon(Icons.search, size: 18),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
                filled: true,
                fillColor: Colors.grey.shade50,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
              ),
              onChanged: onSearch,
            ),
          ),
          Container(
            height: 200,
            child: _isLoadingSecrets
                ? const Center(child: CircularProgressIndicator())
                : _selectedServerId == null
                    ? const Center(child: Text('Select a server first', style: TextStyle(fontSize: 12, color: Colors.grey)))
                    : filtered.isEmpty
                        ? const Center(child: Text('No secrets found', style: TextStyle(fontSize: 12, color: Colors.grey)))
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (ctx, i) => const Divider(height: 1, indent: 12, endIndent: 12),
                            itemBuilder: (ctx, index) {
                              final s = filtered[index];
                              final isSelected = currentValue == s['name'];
                              return ListTile(
                                dense: true,
                                title: Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(s['comment'] ?? 'No comment', style: const TextStyle(fontSize: 10)),
                                    if (s['remote-address'] != null)
                                      Text(s['remote-address'], style: TextStyle(fontSize: 10, color: isOld ? Colors.blue : Colors.green, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isSelected) Icon(Icons.check_circle, color: isOld ? Colors.blue : Colors.green),
                                    IconButton(
                                      icon: Icon(Icons.edit, size: 18, color: Colors.grey.shade600),
                                      onPressed: () => _showEditSecretDialog(s),
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                    ),
                                  ],
                                ),
                                selected: isSelected,
                                selectedTileColor: (isOld ? Colors.blue : Colors.green).withOpacity(0.05),
                                onTap: () => onSelected(s['name']),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
