import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/work_item.dart';
import '../../providers/work_provider.dart';
import '../../widgets/status_badge.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../models/registration.dart';
import '../../constants.dart';

class InstallationDetailScreen extends StatefulWidget {
  final WorkItem item;

  const InstallationDetailScreen({super.key, required this.item});

  @override
  State<InstallationDetailScreen> createState() => _InstallationDetailScreenState();
}

class _InstallationDetailScreenState extends State<InstallationDetailScreen> {
  final _noteController = TextEditingController();
  bool _isLoading = false;
  String? _capturedCoordinates;
  bool _isGettingLocation = false;
  
  // For updates
  List<String> _existingPhotos = [];

  @override
  void initState() {
    super.initState();
    // Initialize existing photos if done
    if (widget.item.originalObject is Registration) {
        final reg = widget.item.originalObject as Registration;
        if (reg.installation != null && reg.installation!.photos.isNotEmpty) {
           _existingPhotos = reg.installation!.photos;
        }
    }
  }

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

  Future<void> _determinePosition() async {
    setState(() => _isGettingLocation = true);
    bool serviceEnabled;
    LocationPermission permission;

    try {
      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location services are disabled.')));
        return;
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are denied')));
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are permanently denied, we cannot request permissions.')));
        return;
      }

      Position position = await Geolocator.getCurrentPosition();
      setState(() {
        _capturedCoordinates = '${position.latitude},${position.longitude}';
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error getting location: $e')));
    } finally {
      if (mounted) setState(() => _isGettingLocation = false);
    }
  }

  void _showCompleteDialog({bool isUpdate = false, String? initialSecretId}) {
      showDialog(
          context: context,
          builder: (ctx) => InstallationCompletionDialog(
              serverId: widget.item.server,
              initialCoordinates: _capturedCoordinates,
              initialPhotos: _existingPhotos,
              initialSecretId: initialSecretId,
              isUpdate: isUpdate,
              onConfirm: _performCompletion,
          )
      );
  }

  void _showEditDialog() {
      final workProvider = Provider.of<WorkProvider>(context, listen: false);
      final technicians = workProvider.technicians;
      
      final techController = TextEditingController(text: widget.item.technician);
      final companionController = TextEditingController(text: widget.item.originalObject is Map ? (widget.item.originalObject['installation']?['companion'] ?? '') : '');
      
      String currentCompanion = '';
      DateTime selectedDate = DateTime.now();
      TimeOfDay selectedTime = TimeOfDay.now();

      try {
         final reg = widget.item.originalObject; 
         // Parse existing date
         if (widget.item.date.isNotEmpty) {
             final dt = DateTime.parse(widget.item.date);
             selectedDate = dt;
             selectedTime = TimeOfDay.fromDateTime(dt);
         }
      } catch (e) {
          print('Error parsing date: $e');
      }

      showDialog(
          context: context,
          builder: (ctx) => StatefulBuilder(
              builder: (context, setState) {
                  return AlertDialog(
                      title: const Text('Edit Working Order'),
                      content: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                              DropdownButtonFormField<String>(
                                  decoration: const InputDecoration(labelText: 'Technician'),
                                  value: technicians.any((t) => t.name == techController.text) ? techController.text : null,
                                  items: technicians.map((t) => DropdownMenuItem(value: t.name, child: Text(t.name))).toList(),
                                  onChanged: (val) => techController.text = val ?? '',
                              ),
                              DropdownButtonFormField<String>(
                                  decoration: const InputDecoration(labelText: 'Companion'),
                                  value: technicians.any((t) => t.name == companionController.text) ? companionController.text : null, 
                                  items: [
                                      const DropdownMenuItem(value: '', child: Text('None')),
                                      ...technicians.map((t) => DropdownMenuItem(value: t.name, child: Text(t.name)))
                                  ],
                                  onChanged: (val) => companionController.text = val ?? '',
                              ),
                              const SizedBox(height: 16),
                              Row(
                                  children: [
                                      Expanded(
                                          child: TextButton(
                                              onPressed: () async {
                                                  final d = await showDatePicker(context: context, firstDate: DateTime(2020), lastDate: DateTime(2030), initialDate: selectedDate);
                                                  if (d != null) setState(() => selectedDate = d);
                                              },
                                              child: Text(DateFormat('yyyy-MM-dd').format(selectedDate)),
                                          )
                                      ),
                                      Expanded(
                                          child: TextButton(
                                              onPressed: () async {
                                                  final t = await showTimePicker(context: context, initialTime: selectedTime);
                                                  if (t != null) setState(() => selectedTime = t);
                                              },
                                              child: Text(selectedTime.format(context)),
                                          )
                                      )
                                  ],
                              )
                          ],
                      ),
                      actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                          ElevatedButton(
                              onPressed: () async {
                                  Navigator.pop(ctx);
                                  setState(() => _isLoading = true);
                                  try {
                                      final dateStr = DateTime(
                                        selectedDate.year, selectedDate.month, selectedDate.day, 
                                        selectedTime.hour, selectedTime.minute
                                      ).toIso8601String();
                                      
                                      await workProvider.updateInstallationDetails(widget.item.id, techController.text, companionController.text, dateStr);
                                      
                                      final user = Provider.of<AuthProvider>(context, listen: false).user;
                                      await workProvider.refreshData(user);
                                      
                                      if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Updated successfully')));
                                          Navigator.pop(context); 
                                      }
                                  } catch (e) {
                                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                                  } finally {
                                      if (mounted) setState(() => _isLoading = false);
                                  }
                              },
                              child: const Text('Save'),
                          )
                      ],
                  );
              }
          )
      );
  }

  Future<void> _performCompletion(String secretId, String? profileName, String coordinates, String secretName, List<XFile> photos, List<String> finalExistingPhotos) async {
     // Delegate loading UI to the Dialog itself to keep it visible
     try {
         final photoPaths = photos.map((e) => e.path).toList();
         await Provider.of<WorkProvider>(context, listen: false).completeInstallation(
            widget.item.id, secretId, widget.item.server, profileName, coordinates, secretName, photoPaths, 
            existingPhotos: finalExistingPhotos
         );
         
         // Success action handled by caller (Dialog) clearing itself, or we can show snackbar here?
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Installation Data Updated!')));
         
         // We do NOT pop here anymore, let the Dialog pop itself on await success.
         // We do NOT set _isLoading here, let Dialog handle its own state.
         
     } catch(e) {
         // Show error but rethrow so Dialog knows it failed
         if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
         rethrow;
     }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    final isAdmin = user?.role == 'admin' || user?.role == 'superadmin';

    return Scaffold(
      appBar: AppBar(
          title: const Text('Installation Details'),
          actions: [
              if (isAdmin)
                IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: _showEditDialog,
                )
          ],
      ),
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
             if (widget.item.status != 'done' && widget.item.status != 'cancel') ...[
                 const SizedBox(height: 12),
                 SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : () {
                            _capturedCoordinates = null; // reset for new capture
                            _existingPhotos = [];
                            _showCompleteDialog();
                        },
                        icon: const Icon(Icons.check_circle),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12)
                        ),
                        label: const Text('Complete Installation'),
                    ),
                 )
             ] else if (widget.item.status == 'done') ...[
                 const SizedBox(height: 24),
                 const Divider(),
                 const Text('Installation Result', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                 const SizedBox(height: 12),
                 if (widget.item.originalObject is Registration) _buildResultSection(widget.item.originalObject as Registration),
                 const SizedBox(height: 12),
                 SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                        onPressed: _isLoading ? null : () {
                             _prepareUpdate(widget.item.originalObject as Registration);
                        },
                        icon: const Icon(Icons.edit),
                        label: const Text('Update Installation Data'),
                    ),
                 )
             ]
          ],
        ),
      ),
    );
  }

  void _prepareUpdate(Registration reg) {
      if (reg.installation != null) {
          _capturedCoordinates = reg.installation!.coordinates;
          _existingPhotos = reg.installation!.photos;
      }
      _showCompleteDialog(isUpdate: true, initialSecretId: reg.installation?.secretId);
  }

  Widget _buildResultSection(Registration reg) {
      if (reg.installation == null) return const Text('No details.');
      
      final inst = reg.installation!;
      return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
           children: [
               if (inst.cost != null) 
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blueGrey.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blueGrey.shade100),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.monetization_on, size: 16, color: Colors.blueGrey),
                          const SizedBox(width: 8),
                          Text('${inst.cost!.name} - Rp ${inst.cost!.price}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey)),
                        ],
                      ),
                    ),
                  ),
               if (inst.secretName != null) Text('PPPoE Account: ${inst.secretName}', style: const TextStyle(fontWeight: FontWeight.bold)),
               if (inst.coordinates != null) 
                  InkWell(
                      onTap: () async {
                           final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=${inst.coordinates}');
                           launchUrl(uri, mode: LaunchMode.externalApplication);
                      },
                      child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Row(children: [
                              const Icon(Icons.location_on, color: Colors.blue, size: 16),
                              const SizedBox(width: 8),
                              Text(inst.coordinates!, style: const TextStyle(color: Colors.blue, decoration: TextDecoration.underline))
                          ]),
                      ),
                  ),
               const SizedBox(height: 8),
               if (inst.photos.isNotEmpty)
                  GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 4, mainAxisSpacing: 4),
                      itemCount: inst.photos.length,
                      itemBuilder: (ctx, idx) {
                          final url = '${AppConstants.baseUrl}${inst.photos[idx]}';
                          return GestureDetector(
                              onTap: () {
                                  showDialog(context: context, builder: (_) => Dialog(child: Image.network(url)));
                              },
                              child: Image.network(url, fit: BoxFit.cover, errorBuilder: (_,__,___) => const Icon(Icons.broken_image)),
                          );
                      }
                  )
          ],
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
                if (widget.item.mapsUrl != null && widget.item.mapsUrl!.isNotEmpty)
                   Padding(
                     padding: const EdgeInsets.symmetric(vertical: 4),
                     child: InkWell(
                       onTap: () async {
                         final uri = Uri.parse(widget.item.mapsUrl!);
                         if (await canLaunchUrl(uri)) {
                           await launchUrl(uri, mode: LaunchMode.externalApplication);
                         } else {
                           if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not launch maps')));
                         }
                       },
                       child: Row(children: [
                         const Icon(Icons.map, size: 16, color: Colors.blue),
                         const SizedBox(width: 8),
                         Text('Open in Maps', style: const TextStyle(color: Colors.blue, decoration: TextDecoration.underline))
                       ]),
                     ),
                   ),
                _rowIcon(Icons.router, widget.item.server),
                if (widget.item.note != null) ...[
                    const SizedBox(height: 12),
                    Text('Note: ${widget.item.note}', style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.amber)),
                ],
                // Show Cost if it exists (even if not done)
                if (widget.item.originalObject is Registration && (widget.item.originalObject as Registration).installation?.cost != null) ...[
                    const SizedBox(height: 12),
                    const Divider(),
                    const Text('Installation Cost', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blueGrey.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blueGrey.shade100),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.monetization_on, size: 16, color: Colors.blueGrey),
                          const SizedBox(width: 8),
                          Text(
                              '${(widget.item.originalObject as Registration).installation!.cost!.name} - Rp ${(widget.item.originalObject as Registration).installation!.cost!.price}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey)
                          ),
                        ],
                      ),
                    ),
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

class InstallationCompletionDialog extends StatefulWidget {
  final String serverId;
  final String? initialCoordinates;
  final List<String> initialPhotos;
  final String? initialSecretId;
  final bool isUpdate;
  final Future<void> Function(String secretId, String? profileName, String coordinates, String secretName, List<XFile> photos, List<String> finalExistingPhotos) onConfirm;

  const InstallationCompletionDialog({
    super.key,
    required this.serverId,
    this.initialCoordinates,
    this.initialPhotos = const [],
    this.initialSecretId,
    required this.isUpdate,
    required this.onConfirm,
  });

  @override
  State<InstallationCompletionDialog> createState() => _InstallationCompletionDialogState();
}

class _InstallationCompletionDialogState extends State<InstallationCompletionDialog> {
  bool _isLoading = true;
  List<dynamic> _secrets = [];
  List<dynamic> _profiles = [];
  String? _selectedSecretId;
  String? _selectedProfile;
  String? _capturedCoordinates;
  bool _isGettingLocation = false;
  bool _isSubmitting = false; // Add this
  List<XFile> _selectedPhotos = [];
  // Existing photos are managed by parent usually, but here we just need to know if we have ANY photos (new or old) for validation.
  // Actually, the parent handles passing existing photos to the complete function. The dialog just handles NEW photos collection?
  // Wait, if I want to show existing photos, I need them passed in.
  // And if duplicates validation is needed...
  
  // Actually, logic is: pass new photos back. Parent merges.
  // BUT the dialog UI showed existing photos and allowed removing them?
  // If so, the dialog needs to manage the list of existing photos too if removal is allowed.
  // Current logic in screen: `_existingPhotos.remove(path)`.
  // So I should accept `initialPhotos` effectively as a mutable list or manage deletion list.
  // Simpler: Maintain `_activeExistingPhotos` local state initialized from `widget.initialPhotos`.
  // But parent needs to know which were removed? 
  // No, the backend `complete` function implementation I wrote accepts `existingPhotos` list.
  // So I can just pass the final list of existing photos back to `onConfirm`.
  // I need to update `onConfirm` signature to accept `existingPhotos` as well to support deletion.

  List<String> _currentExistingPhotos = [];

  @override
  void initState() {
    super.initState();
    _selectedSecretId = widget.initialSecretId;
    _capturedCoordinates = widget.initialCoordinates;
    _currentExistingPhotos = List.from(widget.initialPhotos);
    _loadData();
    if (_capturedCoordinates == null) {
        _autoGetLocation();
    }
  }

  void _loadData() async {
      try {
          final provider = Provider.of<WorkProvider>(context, listen: false);
          final results = await Future.wait([
             provider.fetchSecrets(widget.serverId),
             provider.fetchProfiles(widget.serverId)
          ]);
          if (mounted) {
              setState(() {
                  _secrets = results[0];
                  _profiles = results[1];
                  _isLoading = false;
              });
          }
      } catch (e) {
          if (mounted) setState(() => _isLoading = false);
      }
  }

  void _autoGetLocation() async {
      setState(() => _isGettingLocation = true);
      try {
          // Check service
          bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
          if (!serviceEnabled) {
              // Try to request? Or just fail silently/show manual button
              throw Exception('Service disabled');
          }
           
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
              permission = await Geolocator.requestPermission();
              if (permission == LocationPermission.denied) throw Exception('Permission denied');
          }
          if (permission == LocationPermission.deniedForever) throw Exception('Permission permanently denied');

          Position pos = await Geolocator.getCurrentPosition();
          if (mounted) {
              setState(() {
                  _capturedCoordinates = '${pos.latitude},${pos.longitude}';
              });
          }
      } catch (e) {
          print('Auto location failed: $e');
          // Just stop loading, user can try manually
      } finally {
          if (mounted) setState(() => _isGettingLocation = false);
      }
  }

  @override
  Widget build(BuildContext context) {
      if (_isLoading) {
          return const AlertDialog(
              content: SizedBox(height: 100, child: Center(child: CircularProgressIndicator()))
          );
      }
      return AlertDialog(
          title: Text(widget.isUpdate ? 'Update Installation Data' : 'Complete Installation'),
          content: SizedBox(
              width: double.maxFinite,
              child: SingleChildScrollView(
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                        const Text('Select PPPoE Secret to bind:', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        if (_secrets.isEmpty)
                            const Text('No secrets found on router.', style: TextStyle(color: Colors.red)),
                        if (_secrets.isNotEmpty)
                            DropdownButton<String>(
                                isExpanded: true,
                                value: _selectedSecretId,
                                hint: const Text('Select Account'),
                                items: _secrets.map((s) => DropdownMenuItem<String>(
                                    value: s['.id'],
                                    child: Text(s['name'] ?? 'Unknown'),
                                )).toList(),
                                onChanged: (val) => setState(() => _selectedSecretId = val),
                            ),
                        const SizedBox(height: 12),
                        DropdownButton<String>(
                            isExpanded: true,
                            value: _selectedProfile,
                            hint: const Text('Select Profile'),
                            items: _profiles.map((p) => DropdownMenuItem<String>(
                                value: p['name'],
                                child: Text(p['name'] ?? 'Unknown'),
                            )).toList(),
                            onChanged: (val) => setState(() => _selectedProfile = val),
                        ),
                        const SizedBox(height: 16),
                        
                        // LOCATION
                        const Text('Location Capture:', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        if (_capturedCoordinates != null)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.green.shade200)),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle, size: 20, color: Colors.green),
                                const SizedBox(width: 8),
                                Expanded(child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Location Secured', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                                    Text(_capturedCoordinates!, style: const TextStyle(fontSize: 12)),
                                  ],
                                )),
                                IconButton(icon: const Icon(Icons.refresh, size: 16), onPressed: _autoGetLocation)
                              ],
                            ),
                          ),
                        if (_capturedCoordinates == null)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _isGettingLocation ? null : _autoGetLocation,
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade50, foregroundColor: Colors.blue),
                              icon: _isGettingLocation ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location),
                              label: Text(_isGettingLocation ? 'Detecting Location...' : 'Get Current Location'),
                            ),
                          ),

                        const SizedBox(height: 16),

                        // PHOTOS
                        const Text('Installation Photos:', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Wrap(
                           spacing: 8,
                           runSpacing: 8,
                           children: [
                              // Existing
                              ..._currentExistingPhotos.map((path) => Stack(
                                  children: [
                                     Container(
                                        width: 70, height: 70,
                                        decoration: BoxDecoration(
                                          border: Border.all(color: Colors.blue, width: 2),
                                          borderRadius: BorderRadius.circular(8),
                                          image: DecorationImage(image: NetworkImage('${AppConstants.baseUrl}$path'), fit: BoxFit.cover)
                                        ),
                                     ),
                                     Positioned(right: 0, top: 0, child: InkWell(
                                         onTap: () => setState(() => _currentExistingPhotos.remove(path)),
                                         child: const CircleAvatar(radius: 10, backgroundColor: Colors.red, child: Icon(Icons.close, size: 12, color: Colors.white))
                                     ))
                                  ]
                              )).toList(),
                              
                              // New
                              ..._selectedPhotos.map((f) => Stack(
                                  children: [
                                     Container(
                                        width: 70, height: 70,
                                        decoration: BoxDecoration(
                                          border: Border.all(color: Colors.grey),
                                          borderRadius: BorderRadius.circular(8),
                                          image: DecorationImage(image: FileImage(File(f.path)), fit: BoxFit.cover)
                                        ),
                                     ),
                                     Positioned(right: 0, top: 0, child: InkWell(
                                         onTap: () => setState(() => _selectedPhotos.remove(f)),
                                         child: const CircleAvatar(radius: 10, backgroundColor: Colors.red, child: Icon(Icons.close, size: 12, color: Colors.white))
                                     ))
                                  ]
                              )).toList(),
                              InkWell(
                                  onTap: () async {
                                      final ImagePicker picker = ImagePicker();
                                      final List<XFile> images = await picker.pickMultiImage();
                                      if (images.isNotEmpty) {
                                          setState(() => _selectedPhotos.addAll(images));
                                      }
                                  },
                                  child: Container(
                                      width: 70, height: 70,
                                      decoration: BoxDecoration(
                                          color: Colors.grey.shade100,
                                          border: Border.all(color: Colors.grey.shade300),
                                          borderRadius: BorderRadius.circular(8)
                                      ),
                                      child: const Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                              Icon(Icons.camera_alt, color: Colors.grey),
                                              Text('Add', style: TextStyle(fontSize: 10, color: Colors.grey))
                                          ],
                                      ),
                                  ),
                              )
                           ],
                        )
                    ],
                ),
              ),
          ),
          actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
              ElevatedButton(
                  onPressed: (_isSubmitting || _selectedSecretId == null || _selectedProfile == null || _capturedCoordinates == null || (_selectedPhotos.isEmpty && _currentExistingPhotos.isEmpty)) ? null : () async {
                      setState(() => _isSubmitting = true);
                      final secretName = _secrets.firstWhere((s) => s['.id'] == _selectedSecretId)['name'];
                      
                      try {
                          await widget.onConfirm(_selectedSecretId!, _selectedProfile, _capturedCoordinates!, secretName, _selectedPhotos, _currentExistingPhotos);
                          if(mounted) Navigator.pop(context);
                      } catch(e) {
                          // Error shown by parent Scaffold logic or here?
                          // Parent rethrows, so we catch it here to stop loading.
                      } finally {
                          if(mounted) setState(() => _isSubmitting = false);
                      }
                  },
                  child: _isSubmitting 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(widget.isUpdate ? 'Update Data' : 'Confirm & Finish'),
              )
          ],
      );
  }
}
