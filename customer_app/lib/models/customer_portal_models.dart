class CustomerProfile {
  final String id;
  final String name;
  final String realName;
  final String? phoneNumber;
  final String? address;
  final String packageProfile;
  final String status;
  final String? activationDate;
  final String? subAreaId;
  final bool mustChangePassword;

  CustomerProfile({
    required this.id,
    required this.name,
    required this.realName,
    this.phoneNumber,
    this.address,
    required this.packageProfile,
    required this.status,
    this.activationDate,
    this.subAreaId,
    required this.mustChangePassword,
  });

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Pelanggan',
      realName: json['real_name']?.toString() ?? (json['name']?.toString() ?? 'Pelanggan'),
      phoneNumber: json['phone_number']?.toString(),
      address: json['address']?.toString() ?? '',
      packageProfile: json['profile']?.toString() ?? 'Reguler',
      status: json['status']?.toString() ?? 'active',
      activationDate: json['activationDate']?.toString(),
      subAreaId: json['sub_area_id']?.toString(),
      mustChangePassword: json['mustChangePassword'] == true || json['must_change_password'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'real_name': realName,
    'phone_number': phoneNumber,
    'address': address,
    'profile': packageProfile,
    'status': status,
    'activationDate': activationDate,
    'sub_area_id': subAreaId,
    'mustChangePassword': mustChangePassword,
  };
}

class CustomerInvoice {
  final String id;
  final String period;
  final double amount;
  final String status;
  final String dueDate;
  final String? paymentDate;
  final String? paymentMethod;

  CustomerInvoice({
    required this.id,
    required this.period,
    required this.amount,
    required this.status,
    required this.dueDate,
    this.paymentDate,
    this.paymentMethod,
  });

  factory CustomerInvoice.fromJson(Map<String, dynamic> json) {
    String? payDate;
    String? payMethod;
    if (json['Payments'] is List && (json['Payments'] as List).isNotEmpty) {
      final p = json['Payments'][0];
      payDate = p['transaction_date']?.toString();
      payMethod = p['method']?.toString();
    }

    return CustomerInvoice(
      id: json['id']?.toString() ?? '',
      period: json['period']?.toString() ?? '-',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      status: json['status']?.toString() ?? 'UNPAID',
      dueDate: json['due_date']?.toString() ?? '-',
      paymentDate: payDate,
      paymentMethod: payMethod,
    );
  }
}

class VoucherUsageData {
  final String bytesIn;
  final String bytesOut;
  final String uptime;
  final String limitBytesTotal;
  final String limitUptime;
  final bool disabled;
  final bool isQuotaExhausted;
  final bool isOnline;
  final String sessionUptime;
  final String sessionBytesIn;
  final String sessionBytesOut;
  final String ipAddress;
  final String macAddress;
  // Device & session detail fields
  final String deviceHostname;
  final String loginBy;
  final String hotspotServer;
  final String idleTime;
  final String sessionTotalBytes;
  final String dhcpServer;
  final String dhcpStatus;
  final String dhcpLastSeen;

  VoucherUsageData({
    this.bytesIn = '0',
    this.bytesOut = '0',
    this.uptime = '0s',
    this.limitBytesTotal = '0',
    this.limitUptime = '',
    this.disabled = false,
    this.isQuotaExhausted = false,
    this.isOnline = false,
    this.sessionUptime = '',
    this.sessionBytesIn = '0',
    this.sessionBytesOut = '0',
    this.ipAddress = '',
    this.macAddress = '',
    this.deviceHostname = '',
    this.loginBy = '',
    this.hotspotServer = '',
    this.idleTime = '',
    this.sessionTotalBytes = '0',
    this.dhcpServer = '',
    this.dhcpStatus = '',
    this.dhcpLastSeen = '',
  });

  factory VoucherUsageData.fromJson(Map<String, dynamic> json) {
    return VoucherUsageData(
      bytesIn: json['bytes_in']?.toString() ?? '0',
      bytesOut: json['bytes_out']?.toString() ?? '0',
      uptime: json['uptime']?.toString() ?? '0s',
      limitBytesTotal: json['limit_bytes_total']?.toString() ?? '0',
      limitUptime: json['limit_uptime']?.toString() ?? '',
      disabled: json['disabled'] == true,
      isQuotaExhausted: json['is_quota_exhausted'] == true,
      isOnline: json['is_online'] == true,
      sessionUptime: json['session_uptime']?.toString() ?? '',
      sessionBytesIn: json['session_bytes_in']?.toString() ?? '0',
      sessionBytesOut: json['session_bytes_out']?.toString() ?? '0',
      ipAddress: json['ip_address']?.toString() ?? '',
      macAddress: json['mac_address']?.toString() ?? '',
      deviceHostname: json['device_hostname']?.toString() ?? '',
      loginBy: json['login_by']?.toString() ?? '',
      hotspotServer: json['hotspot_server']?.toString() ?? '',
      idleTime: json['idle_time']?.toString() ?? '',
      sessionTotalBytes: json['session_total_bytes']?.toString() ?? '0',
      dhcpServer: json['dhcp_server']?.toString() ?? '',
      dhcpStatus: json['dhcp_status']?.toString() ?? '',
      dhcpLastSeen: json['dhcp_last_seen']?.toString() ?? '',
    );
  }

  /// Total bytes used (in + out)
  int get totalBytesUsed {
    final bIn = int.tryParse(bytesIn) ?? 0;
    final bOut = int.tryParse(bytesOut) ?? 0;
    return bIn + bOut;
  }

  /// Session total bytes as int
  int get sessionTotal {
    return int.tryParse(sessionTotalBytes) ?? 0;
  }

  /// Limit bytes total as int
  int get limitBytes {
    return int.tryParse(limitBytesTotal) ?? 0;
  }

  /// Usage percentage (0.0 - 1.0)
  double get usagePercent {
    if (limitBytes <= 0) return 0.0;
    final pct = totalBytesUsed / limitBytes;
    return pct > 1.0 ? 1.0 : pct;
  }

  /// Format bytes to human-readable string
  static String formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1048576) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1073741824) return '${(bytes / 1048576).toStringAsFixed(2)} MB';
    return '${(bytes / 1073741824).toStringAsFixed(2)} GB';
  }
}

class CustomerVoucherItem {
  final String id;
  final String voucherCode;
  final String? voucherPassword;
  final String profile;
  final int quotaGb;
  final String validity;
  final String status;
  final String? notes;
  final String? createdAt;
  final String? loginUrl;
  final String? serverHotspotUrl;
  final VoucherUsageData? usage;

  CustomerVoucherItem({
    required this.id,
    required this.voucherCode,
    this.voucherPassword,
    required this.profile,
    required this.quotaGb,
    required this.validity,
    required this.status,
    this.notes,
    this.createdAt,
    this.loginUrl,
    this.serverHotspotUrl,
    this.usage,
  });

  factory CustomerVoucherItem.fromJson(Map<String, dynamic> json) {
    return CustomerVoucherItem(
      id: json['id']?.toString() ?? '',
      voucherCode: json['voucher_code']?.toString() ?? '',
      voucherPassword: json['voucher_password']?.toString(),
      profile: json['profile']?.toString() ?? 'default',
      quotaGb: int.tryParse(json['quota_gb']?.toString() ?? '0') ?? 0,
      validity: json['validity']?.toString() ?? '30d',
      status: json['status']?.toString() ?? 'active',
      notes: json['notes']?.toString(),
      createdAt: json['createdAt']?.toString(),
      loginUrl: json['login_url']?.toString(),
      serverHotspotUrl: json['server_hotspot_url']?.toString(),
      usage: json['usage'] is Map<String, dynamic>
          ? VoucherUsageData.fromJson(json['usage'])
          : null,
    );
  }
}
