import 'package:flutter/material.dart';
import '../models/invoice.dart';
import '../services/api_service.dart';

class InvoiceProvider with ChangeNotifier {
  final ApiService _api = ApiService();
  
  List<Invoice> _invoices = [];
  bool _isLoading = false;
  int _total = 0;

  List<Invoice> get invoices => _invoices;
  bool get isLoading => _isLoading;
  int get total => _total;

  Future<void> fetchInvoices({
    String? status,
    String? serverId,
    String? subAreaId,
    String? search,
    int page = 1,
    int limit = 100,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      String query = '?page=$page&limit=$limit';
      if (status != null && status.isNotEmpty) query += '&status=$status';
      if (serverId != null && serverId.isNotEmpty) query += '&serverId=$serverId';
      if (search != null && search.isNotEmpty) query += '&search=$search';
      
      // Note: Backend might need to be checked if 'subAreaId' filter is implemented in /api/billing/invoices
      // Based on server/index.js, it filters by customer search which can include subArea if modified,
      // but let's check the backend billing route again.
      if (subAreaId != null && subAreaId.isNotEmpty) query += '&subAreaId=$subAreaId';

      final res = await _api.get('/billing/invoices$query');
      
      if (res != null) {
        final List data = res['data'] ?? [];
        _invoices = data.map((json) => Invoice.fromJson(json)).toList();
        _total = res['meta']?['total'] ?? _invoices.length;
      }
    } catch (e) {
      print('Error fetching invoices: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<dynamic>> fetchHistory(String invoiceId) async {
    try {
      return await _api.get('/billing/invoices/$invoiceId/history');
    } catch (e) {
      print('Error fetching invoice history: $e');
      return [];
    }
  }
}
