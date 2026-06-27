import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/work_provider.dart';
import '../services/api_service.dart';
import 'package:geolocator/geolocator.dart';

class UpdateMapUserScreen extends StatefulWidget {
  const UpdateMapUserScreen({super.key});

  @override
  State<UpdateMapUserScreen> createState() => _UpdateMapUserScreenState();
}

class _UpdateMapUserScreenState extends State<UpdateMapUserScreen> {
  String? _selectedServer;
  String? _selectedCustomer;
  bool _isLoading = false;
  Position? _currentPosition;

  Future<void> _getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location services are disabled.')));
      return;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are denied')));
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are permanently denied, we cannot request permissions.')));
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
        Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        setState(() {
            _currentPosition = position;
        });
        if(mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location retrieved!')));
    } catch(e) {
        if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error getting location: $e')));
    } finally {
        setState(() {
            _isLoading = false;
        });
    }
  }

  Future<void> _saveLocation() async {
    if (_selectedCustomer == null || _currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select a user and get location first')));
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final workFn = Provider.of<WorkProvider>(context, listen: false);
      final customer = workFn.customers.firstWhere((c) => c.id == _selectedCustomer || c.name == _selectedCustomer);
      
      final api = ApiService();
      final customerId = customer.crmId ?? customer.id ?? customer.name;
      
      final mapsUrl = 'https://maps.google.com/?q=${_currentPosition!.latitude},${_currentPosition!.longitude}';

      final Map<String, dynamic> body = {
        'serverId': _selectedServer,
        'coordinates': '${_currentPosition!.latitude},${_currentPosition!.longitude}',
        'mapsUrl': mapsUrl,
      };

      await api.put('/customers/$customerId', body);

      // Try updating registration too if present
      if (customer.registrationId != null) {
          try {
              await api.put('/registrations/${customer.registrationId}', {'mapsUrl': mapsUrl});
          } catch(e) {
              // ignore
          }
      }

      if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location saved successfully')));
          setState(() {
             _selectedCustomer = null;
             _currentPosition = null;
          });
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error saving: $e')));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    final servers = workFn.servers;
    
    // Filter customers
    final serverCustomers = workFn.customers.where((c) => c.serverId == _selectedServer && !(c.disabled ?? false)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Update Map User')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('1. Select Server', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12)),
              value: _selectedServer,
              hint: const Text('Select a server'),
              items: servers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
              onChanged: (val) {
                setState(() {
                  _selectedServer = val;
                  _selectedCustomer = null;
                });
              },
            ),
            const SizedBox(height: 24),
            const Text('2. Select User', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12)),
              value: _selectedCustomer,
              hint: Text(_selectedServer == null ? 'Select server first' : 'Select user'),
              isExpanded: true,
              items: serverCustomers.map((c) => DropdownMenuItem(value: c.id ?? c.name, child: Text('${c.name} ${c.realName != null ? "(${c.realName})" : ""}'))).toList(),
              onChanged: _selectedServer == null ? null : (val) {
                setState(() {
                  _selectedCustomer = val;
                });
              },
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              icon: _isLoading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.my_location),
              label: const Text('Get My Location'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                backgroundColor: Colors.blue.shade700,
                foregroundColor: Colors.white,
              ),
              onPressed: _isLoading ? null : _getCurrentLocation,
            ),
            if (_currentPosition != null) ...[
                const SizedBox(height: 16),
                Container(
                    padding: const EdgeInsets.all(12),
                    color: Colors.blue.shade50,
                    child: Text('Lat: ${_currentPosition!.latitude}\nLng: ${_currentPosition!.longitude}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
            ],
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.save),
              label: const Text('Save Location'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                backgroundColor: Colors.green.shade600,
                foregroundColor: Colors.white,
              ),
              onPressed: _isLoading || _selectedCustomer == null || _currentPosition == null ? null : _saveLocation,
            ),
          ],
        ),
      ),
    );
  }
}
