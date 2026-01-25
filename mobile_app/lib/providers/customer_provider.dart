import 'package:flutter/material.dart';
import '../models/customer.dart';
import '../services/api_service.dart';

class CustomerProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  
  List<Customer> _customers = [];
  bool _isLoading = false;

  List<Customer> get customers => _customers;
  bool get isLoading => _isLoading;

  Future<void> fetchCustomers() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.get('/customers');
      if (response is List) {
        _customers = response.map((json) => Customer.fromJson(json)).toList();
      }
    } catch (e) {
      print('Error fetching customers: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleStatus(String id, bool currentDisabledState, {String? serverId, String? name}) async {
      // We need serverId to find the server to toggle secret on Mikrotik.
      // But for now, let's assume the backend handles it via ID or we pass server info.
      // The backend `togglePPPSecret` logic relies on `server` object.
      // Ideally we call an endpoint that handles the logic.
      // In `Servers.tsx`, it calls `MikrotikApi.togglePPPSecret`.
      // Let's create a proxy endpoint or similar in backend if simpler?
      // Actually `WorkProvider.completeInstallation` uses `/proxy`.
      // But `CustomerProvider` should probably just call a specific API endpoint if available.
      // The current backend likely doesn't have a direct "toggle customer" endpoint that does it all.
      // It has `POST /api/customers/meta` etc.
      
      // Let's check backend `index.js` again? 
      // It has `POST /api/billing/check-overdue` (auto block).
      // It has `PUT /api/customers/:id` (CRM data).
      // It DOES NOT seem to have a specific "toggle status" endpoint for manual toggle that also hits Mikrotik.
      // So we might need to use `/api/proxy` here too similar to `WorkProvider`.
      
      // However, we need the server credentials.
      // The `Customer` model has `serverId`.
      // We need to fetch the server details first.
      
      // Wait, `AuthProvider` or `WorkProvider` has servers? 
      // `CustomerProvider` doesn't fetch servers list yet. 
      // Let's fetch servers or rely on backend.
      
      // Simplest way: Add a new endpoint to backend meant for "toggle customer"? 
      // The user wants "action admin yang ada di web".
      // Web uses `MikrotikApi.togglePPPSecret` which calls `/proxy`.
      
      // So mobile should also call `/proxy`.
      // To do that, we need server credentials.
      // We should fetch servers in `CustomerProvider` or accept them.
      
      // Let's just implement `toggleStatus` assuming we will fetch servers or have them.
      // Or better, let's update `CustomerProvider` to also fetch `servers` so it can look them up.
      
      // Actually, `WorkProvider` already fetches servers. Maybe we can reuse it?
      // But providers are separate.
      // Let's just fetch servers in `CustomerProvider` too for now, or fetch on demand.
      
      // Implementation:
      try {
        // 1. Fetch server credentials
        if (serverId == null) throw Exception('Server ID missing');
        
        final serverRes = await _api.get('/servers');
        if (serverRes is! List) throw Exception('Failed to load servers');
        
        final server = serverRes.firstWhere((s) => s['id'] == serverId, orElse: () => null);
        if (server == null) throw Exception('Server not found');
        
        // 2. Proxy Toggle
        // command: /ppp/secret/enable or disable
        final cmd = currentDisabledState ? '/ppp/secret/enable' : '/ppp/secret/disable';
        // We need the ID of the secret. Mobile Customer model has `id` which IS the Mikrotik ID (from cache).
        // Cache `id` usually is the Mikrotik ID (e.g. `*12`).
        
        await _api.post('/proxy', {
            'host': server['ip'],
            'user': server['username'],
            'password': server['password'],
            'port': server['port'],
            'command': [cmd, '=.id=$id']
        });
        
        // 3. Update Local State (Optimistic)
        // Refresh?
         await fetchCustomers();
         
      } catch (e) {
          rethrow;
      }
  }

  Future<void> updateCustomer(String id, Map<String, dynamic> data) async {
       // This hits the CRM endpoint
       await _api.put('/customers/$id', data);
       await fetchCustomers();
  }
}
