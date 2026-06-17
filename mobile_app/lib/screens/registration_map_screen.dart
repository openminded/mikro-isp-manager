import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../providers/work_provider.dart';
import '../models/registration.dart';
import 'details/registration_detail_screen.dart';

class RegistrationMapScreen extends StatefulWidget {
  const RegistrationMapScreen({super.key});

  @override
  State<RegistrationMapScreen> createState() => _RegistrationMapScreenState();
}

class _RegistrationMapScreenState extends State<RegistrationMapScreen> {
  String _view = 'active'; // 'active', 'completed', 'cancelled'

  LatLng? _extractCoordinates(String url) {
    if (url.isEmpty) return null;
    try {
      if (url.contains('?q=')) {
        final parts = url.split('?q=')[1].split('&')[0].split(',');
        if (parts.length >= 2) {
          return LatLng(double.parse(parts[0]), double.parse(parts[1]));
        }
      } else if (url.contains('@')) {
        final parts = url.split('@')[1].split(',');
        if (parts.length >= 2) {
          return LatLng(double.parse(parts[0]), double.parse(parts[1]));
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  Color _getServerColor(String locationId) {
    if (locationId.isEmpty) return Colors.blueGrey;
    int hash = 0;
    for (int i = 0; i < locationId.length; i++) {
      hash = locationId.codeUnitAt(i) + ((hash << 5) - hash);
    }
    final colors = [
      Colors.indigo, Colors.teal, Colors.cyan, Colors.purple,
      Colors.pink, Colors.deepOrange, Colors.blue, Colors.green
    ];
    return colors[hash.abs() % colors.length];
  }

  Color _getStatusColor(String status) {
    if (status == 'queue') return Colors.amber;
    if (status == 'installation_process') return Colors.blue;
    if (status == 'done') return Colors.green;
    if (status.startsWith('cancel')) return Colors.red;
    return Colors.blueGrey;
  }

  void _showRegistrationInfo(BuildContext context, Registration reg) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: _getStatusColor(reg.status).withOpacity(0.2),
                  child: Icon(Icons.person, color: _getStatusColor(reg.status)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(reg.fullName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(reg.phoneNumber, style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(child: Text(reg.address, style: const TextStyle(fontSize: 14))),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.dns, size: 16, color: Colors.grey),
                const SizedBox(width: 8),
                Text('Server: ${reg.locationId}'),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => RegistrationDetailScreen(registration: reg)));
                },
                child: const Text('View Details'),
              ),
            )
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workFn = Provider.of<WorkProvider>(context);
    final allRegistrations = workFn.registrations;

    // Filter registrations
    final filteredRegistrations = allRegistrations.where((r) {
      if (_view == 'completed') {
        return r.status == 'done';
      } else if (_view == 'cancelled') {
        return r.status.startsWith('cancel');
      } else {
        return r.status != 'done' && !r.status.startsWith('cancel');
      }
    }).toList();

    List<Marker> markers = [];
    for (var reg in filteredRegistrations) {
      if (reg.mapsUrl != null) {
        final coords = _extractCoordinates(reg.mapsUrl!);
        if (coords != null) {
          markers.add(
            Marker(
              point: coords,
              width: 40,
              height: 40,
              child: GestureDetector(
                onTap: () => _showRegistrationInfo(context, reg),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Icon(Icons.location_on, color: _getServerColor(reg.locationId), size: 40),
                    Positioned(
                      top: 6,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: _getStatusColor(reg.status),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Registration Map'),
        actions: [
          PopupMenuButton<String>(
            onSelected: (val) => setState(() => _view = val),
            icon: const Icon(Icons.filter_list),
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'active', child: Text('Active Registrations')),
              const PopupMenuItem(value: 'completed', child: Text('Completed')),
              const PopupMenuItem(value: 'cancelled', child: Text('Cancelled')),
            ],
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: const LatLng(-0.366535, 101.556898),
              initialZoom: 13,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
                userAgentPackageName: 'com.example.app',
              ),
              MarkerLayer(markers: markers),
            ],
          ),
          // Simple Legend
          Positioned(
            bottom: 20,
            left: 20,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.9),
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Map Legend (Status)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(height: 8),
                  if (_view == 'active') ...[
                    _buildLegendItem(Colors.amber, 'Pending'),
                    _buildLegendItem(Colors.blue, 'Installing'),
                  ],
                  if (_view == 'completed')
                    _buildLegendItem(Colors.green, 'Done'),
                  if (_view == 'cancelled')
                    _buildLegendItem(Colors.red, 'Cancelled'),
                  const SizedBox(height: 8),
                  const Text('Pin color represents Server.', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}
