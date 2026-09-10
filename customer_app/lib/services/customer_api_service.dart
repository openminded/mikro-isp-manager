import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../models/customer_portal_models.dart';
import '../services/customer_api_service.dart';

enum LoginResultState { success, multipleAccounts, failed }

class CustomerAuthService {
  String _baseUrl = AppConstants.defaultApiUrl;
  String? _token;

  String get baseUrl => _baseUrl;
  String? get token => _token;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('cust_token');
    if (kDebugMode) {
      _baseUrl = AppConstants.defaultApiUrl;
      await prefs.setString('cust_api_url', _baseUrl);
      debugPrint('[CustomerAuth] Debug mode active. Api URL forced to: $_baseUrl');
      return;
    }
    final savedUrl = prefs.getString('cust_api_url');
    if (savedUrl != null && savedUrl.isNotEmpty) {
      _baseUrl = savedUrl;
    } else {
      _baseUrl = AppConstants.defaultApiUrl;
      await prefs.setString('cust_api_url', _baseUrl);
    }
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cust_api_url', _baseUrl);
  }

  Map<String, String> get _headers {
    final headers = {'Content-Type': 'application/json'};
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> login(String phone, String password, {String? selectedCustomerId}) async {
    final uri = Uri.parse('$_baseUrl/customer-auth/login');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phone': phone.trim(),
        'password': password.trim(),
        if (selectedCustomerId != null) 'selectedCustomerId': selectedCustomerId,
      }),
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Koneksi ke server RTO/Timeout. Pastikan terhubung ke internet.'),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300 && data['success'] == true) {
      _token = data['token'];
      final prefs = await SharedPreferences.getInstance();
      if (_token != null) await prefs.setString('cust_token', _token!);
      await prefs.setString('cust_profile', jsonEncode(data['customer']));
      return data;
    } else if (data['multipleAccounts'] == true) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Login gagal, periksa nomor HP atau sandi Anda.');
    }
  }

  Future<void> changePassword({
    required String customerId,
    required String oldPassword,
    required String newPassword,
  }) async {
    final uri = Uri.parse('$_baseUrl/customer-auth/change-password');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({
        'customerId': customerId,
        'oldPassword': oldPassword,
        'newPassword': newPassword,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300 && data['success'] == true) {
      return;
    } else {
      throw Exception(data['error'] ?? 'Gagal mengganti kata sandi.');
    }
  }

  Future<Map<String, dynamic>> fetchDashboard(String customerId) async {
    final uri = Uri.parse('$_baseUrl/customer-portal/dashboard?customerId=$customerId');
    final response = await http.get(uri, headers: _headers).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Waktu pemuatan data habis (Timeout).'),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300 && data['success'] == true) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Gagal memuat data pelanggan');
    }
  }

  Future<Map<String, dynamic>> checkWifiStatus(String customerId) async {
    final uri = Uri.parse('$_baseUrl/customer-portal/wifi-status?customerId=$customerId');
    final response = await http.get(uri, headers: _headers).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Cek status WiFi timeout.'),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300 && data['success'] == true) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Gagal mengecek status WiFi');
    }
  }

  Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cust_token');
    await prefs.remove('cust_profile');
  }
}
