import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/customer_portal_models.dart';
import '../services/customer_api_service.dart';

class CustomerProvider with ChangeNotifier {
  final CustomerAuthService _apiService = CustomerAuthService();

  CustomerProfile? _customer;
  List<CustomerInvoice> _invoices = [];
  List<CustomerVoucherItem> _vouchers = [];

  bool _isLoading = false;
  bool _isInitialLoading = true;
  String? _errorMessage;

  // Status WiFi (PPP Active) - On Demand only
  bool _isCheckingWifi = false;
  String? _wifiStatus; // 'online' | 'offline' | null
  String? _wifiLabel;  // 'Terhubung' | 'Tidak Aktif' | null
  String? _wifiUptime;
  String? _wifiUsage;
  String? _wifiCheckedAt;

  CustomerProfile? get customer => _customer;
  List<CustomerInvoice> get invoices => _invoices;
  List<CustomerVoucherItem> get vouchers => _vouchers;
  bool get isLoading => _isLoading;
  bool get isInitialLoading => _isInitialLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _customer != null;
  bool get mustChangePassword => _customer?.mustChangePassword ?? false;
  CustomerAuthService get apiService => _apiService;

  bool get isCheckingWifi => _isCheckingWifi;
  String? get wifiStatus => _wifiStatus;
  String? get wifiLabel => _wifiLabel;
  String? get wifiUptime => _wifiUptime;
  String? get wifiUsage => _wifiUsage;
  String? get wifiCheckedAt => _wifiCheckedAt;

  Future<void> init() async {
    _isInitialLoading = true;
    notifyListeners();

    try {
      await _apiService.init();
      final prefs = await SharedPreferences.getInstance();
      final profileStr = prefs.getString('cust_profile');
      final vouchersStr = prefs.getString('cust_vouchers_cache');
      
      // Load offline cached vouchers immediately so user can see and activate them without network
      if (vouchersStr != null) {
        try {
          final List vList = jsonDecode(vouchersStr);
          _vouchers = vList.map((e) => CustomerVoucherItem.fromJson(e)).toList();
        } catch (_) {}
      }

      if (profileStr != null && _apiService.token != null) {
        final profileMap = jsonDecode(profileStr);
        _customer = CustomerProfile.fromJson(profileMap);
        await refreshDashboard();
      }
    } catch (e) {
      debugPrint('[CustomerProvider] Init error: $e');
    } finally {
      _isInitialLoading = false;
      notifyListeners();
    }
  }

  List<Map<String, dynamic>> _availableAccounts = [];
  List<Map<String, dynamic>> get availableAccounts => _availableAccounts;

  Future<LoginResultState> login(String phone, String password, {String? selectedCustomerId}) async {
    _isLoading = true;
    _errorMessage = null;
    _availableAccounts = [];
    notifyListeners();

    try {
      final res = await _apiService.login(phone, password, selectedCustomerId: selectedCustomerId);
      if (res['multipleAccounts'] == true) {
        _availableAccounts = List<Map<String, dynamic>>.from(res['accounts'] ?? []);
        _isLoading = false;
        notifyListeners();
        return LoginResultState.multipleAccounts;
      }

      _customer = CustomerProfile.fromJson(res['customer']);
      await refreshDashboard();
      _isLoading = false;
      notifyListeners();
      return LoginResultState.success;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return LoginResultState.failed;
    }
  }

  Future<bool> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    if (_customer == null) return false;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _apiService.changePassword(
        customerId: _customer!.id,
        oldPassword: oldPassword,
        newPassword: newPassword,
      );

      // Update local state
      _customer = CustomerProfile(
        id: _customer!.id,
        name: _customer!.name,
        realName: _customer!.realName,
        phoneNumber: _customer!.phoneNumber,
        address: _customer!.address,
        packageProfile: _customer!.packageProfile,
        status: _customer!.status,
        activationDate: _customer!.activationDate,
        subAreaId: _customer!.subAreaId,
        mustChangePassword: false,
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cust_profile', jsonEncode(_customer!.toJson()));

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshDashboard() async {
    if (_customer == null) return;
    try {
      final res = await _apiService.fetchDashboard(_customer!.id);
      if (res['customer'] != null) {
        _customer = CustomerProfile.fromJson(res['customer']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cust_profile', jsonEncode(res['customer']));
      }
      if (res['invoices'] is List) {
        _invoices = (res['invoices'] as List)
            .map((e) => CustomerInvoice.fromJson(e))
            .toList();
      }
      if (res['vouchers'] is List) {
        final newVouchers = (res['vouchers'] as List)
            .map((e) => CustomerVoucherItem.fromJson(e))
            .toList();

        // Preserve existing usage data if new usage data is empty/null due to temporary router connection drop
        final Map<String, VoucherUsageData> existingUsageMap = {
          for (var v in _vouchers)
            if (v.usage != null && (v.usage!.totalBytesUsed > 0 || v.usage!.disabled))
              v.voucherCode.toLowerCase().trim(): v.usage!
        };

        _vouchers = newVouchers.map((newV) {
          if (newV.usage == null || (newV.usage!.totalBytesUsed == 0 && !newV.usage!.disabled && !newV.usage!.isQuotaExhausted)) {
            final key = newV.voucherCode.toLowerCase().trim();
            final oldUsage = existingUsageMap[key];
            if (oldUsage != null) {
              return CustomerVoucherItem(
                id: newV.id,
                voucherCode: newV.voucherCode,
                voucherPassword: newV.voucherPassword,
                profile: newV.profile,
                quotaGb: newV.quotaGb,
                validity: newV.validity,
                status: oldUsage.disabled ? 'disabled' : newV.status,
                notes: newV.notes,
                createdAt: newV.createdAt,
                loginUrl: newV.loginUrl,
                serverHotspotUrl: newV.serverHotspotUrl,
                usage: oldUsage,
              );
            }
          }
          return newV;
        }).toList();

        // Sort: active + online first, then active, then others (disabled/expired)
        _vouchers.sort((a, b) {
          final aDisabled = a.usage?.disabled == true || a.status.toLowerCase() == 'disabled' || a.status.toLowerCase() == 'suspended';
          final bDisabled = b.usage?.disabled == true || b.status.toLowerCase() == 'disabled' || b.status.toLowerCase() == 'suspended';
          final aActive = a.status.toLowerCase() == 'active' && !aDisabled;
          final bActive = b.status.toLowerCase() == 'active' && !bDisabled;
          final aOnline = a.usage?.isOnline == true && !aDisabled;
          final bOnline = b.usage?.isOnline == true && !bDisabled;
          // Priority: online+active (0) > active (1) > inactive/disabled (2)
          final aPriority = aOnline && aActive ? 0 : aActive ? 1 : 2;
          final bPriority = bOnline && bActive ? 0 : bActive ? 1 : 2;
          return aPriority.compareTo(bPriority);
        });
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cust_vouchers_cache', jsonEncode(res['vouchers']));
      }
      notifyListeners();
    } catch (e) {
      debugPrint('[CustomerProvider] Refresh error: $e');
    }
  }

  /// Mengecek status koneksi WiFi pelanggan (PPP Active di MikroTik).
  /// PERHATIAN: Sesuai instruksi, fungsi ini TIDAK dipanggil otomatis saat buka beranda,
  /// melainkan HANYA ketika tombol reload status WiFi ditekan oleh pelanggan.
  Future<void> checkWifiStatus() async {
    if (_customer == null || _isCheckingWifi) return;
    _isCheckingWifi = true;
    notifyListeners();

    try {
      final res = await _apiService.checkWifiStatus(_customer!.id);
      _wifiStatus = res['status'] ?? (res['connected'] == true ? 'online' : 'offline');
      _wifiLabel = res['label'] ?? (res['connected'] == true ? 'Terhubung' : 'Tidak Aktif');
      _wifiUptime = res['uptime']?.toString();
      _wifiUsage = res['usage']?.toString();
      final checkedAt = res['checkedAt'] != null ? DateTime.tryParse(res['checkedAt']) : DateTime.now();
      if (checkedAt != null) {
        final h = checkedAt.hour.toString().padLeft(2, '0');
        final m = checkedAt.minute.toString().padLeft(2, '0');
        final s = checkedAt.second.toString().padLeft(2, '0');
        _wifiCheckedAt = '$h:$m:$s';
      }
    } catch (e) {
      debugPrint('[CustomerProvider] checkWifiStatus error: $e');
      _wifiStatus = 'offline';
      _wifiLabel = 'Tidak Aktif';
      _wifiUptime = null;
      _wifiUsage = null;
    } finally {
      _isCheckingWifi = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
    _customer = null;
    _invoices = [];
    _vouchers = [];
    _wifiStatus = null;
    _wifiLabel = null;
    _wifiUptime = null;
    _wifiUsage = null;
    _wifiCheckedAt = null;
    _isCheckingWifi = false;
    notifyListeners();
  }
}
