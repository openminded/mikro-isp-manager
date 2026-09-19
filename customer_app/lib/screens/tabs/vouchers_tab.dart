import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../../providers/customer_provider.dart';
import '../../models/customer_portal_models.dart';

class VouchersTab extends StatelessWidget {
  const VouchersTab({super.key});

  void _copyToClipboard(BuildContext context, String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Kode voucher "$code" disalin ke papan klip'),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF1E293B),
      ),
    );
  }

  Future<void> _activateVoucher(BuildContext context, CustomerVoucherItem voucher) async {
    final loginUrl = voucher.loginUrl;
    if (loginUrl == null || loginUrl.isEmpty) {
      _copyToClipboard(context, voucher.voucherCode);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Kode voucher telah disalin. Hubungkan ke WiFi Hotspot lalu paste di form login.'),
          backgroundColor: Color(0xFFE53935),
        ),
      );
      return;
    }

    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Center(
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: Color(0xFF16A34A)),
              const SizedBox(height: 16),
              Text(
                'Mengaktifkan Voucher...',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 4),
              Text(
                voucher.voucherCode,
                style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF16A34A), fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );

    bool activatedSuccess = false;
    String statusMsg = '';

    try {
      // Step 1: Direct HTTP GET / POST to MikroTik router Hotspot Login
      final uri = Uri.parse(loginUrl);
      final resp = await http.get(uri).timeout(const Duration(seconds: 6));
      
      if (resp.statusCode == 200 || resp.statusCode == 302 || resp.statusCode == 301) {
        activatedSuccess = true;
        statusMsg = 'Voucher berhasil diaktivasi ke Hotspot MikroTik!';
      } else {
        activatedSuccess = true;
        statusMsg = 'Permintaan aktivasi dikirim ke router WiFi!';
      }
    } catch (e) {
      // Network timeout or local redirect
      activatedSuccess = true;
      statusMsg = 'Permintaan login voucher dikirim ke gateway hotspot.';
    }

    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop(); // Dismiss loading
      
      // Auto-copy as convenience
      Clipboard.setData(ClipboardData(text: voucher.voucherCode));

      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: Row(
            children: const [
              Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 26),
              SizedBox(width: 8),
              Text('Aktivasi Dikirim', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(statusMsg, style: const TextStyle(fontSize: 13, color: Color(0xFF334155))),
              const SizedBox(height: 12),
              InkWell(
                onTap: () async {
                  try {
                    const channel = MethodChannel('com.ayd.giganusa/launcher');
                    await channel.invokeMethod('openBrowser', {'url': loginUrl});
                  } catch (e) {
                    debugPrint('Error launching url: $e');
                  }
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF93C5FD)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.open_in_browser_rounded, color: Color(0xFF2563EB), size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Link Login (Klik untuk Buka di Browser):', style: TextStyle(fontSize: 10, color: Color(0xFF1E40AF), fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            Text(
                              loginUrl,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF2563EB), fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Pastikan HP Anda sudah terhubung ke WiFi Hotspot agar akses internet langsung aktif tanpa login ulang.',
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.open_in_new_rounded, size: 16),
              label: const Text('Buka Halaman Login'),
              onPressed: () async {
                try {
                  const channel = MethodChannel('com.ayd.giganusa/launcher');
                  await channel.invokeMethod('openBrowser', {'url': loginUrl});
                } catch (e) {
                  debugPrint('Error launching url: $e');
                }
              },
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CustomerProvider>();
    final vouchers = provider.vouchers;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Voucher Kuota Saya', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded),
            onPressed: () => _showGuideDialog(context),
            tooltip: 'Panduan Cara Pakai',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.refreshDashboard(),
            tooltip: 'Segarkan',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.refreshDashboard(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Panduan Sistematis Cara Pakai Voucher (Expandable/Highlight Card)
              _buildGuideBanner(context),
              const SizedBox(height: 16),

              // Title Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Daftar Voucher Tersedia',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                  ),
                  Text(
                    '${vouchers.length} Voucher',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              if (vouchers.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.confirmation_number_outlined, size: 56, color: Color(0xFFCBD5E1)),
                        SizedBox(height: 14),
                        Text(
                          'Belum Ada Voucher Kuota',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'Voucher kuota tambahan yang dibagikan admin/teknisi akan muncul di sini.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...vouchers.map((v) => _buildVoucherCard(context, v)),
            ],
          ),
        ),
      ),
    );
  }

  // --- Widget Panduan Sistematis Cara Pakai Voucher ---
  Widget _buildGuideBanner(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD97706).withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: false,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.menu_book_rounded, color: Color(0xFFB45309), size: 20),
          ),
          title: const Text(
            'Panduan Cara Pakai Voucher',
            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
          ),
          subtitle: const Text(
            'Klik untuk melihat 5 langkah mudah aktivasi',
            style: TextStyle(fontSize: 11, color: Color(0xFFB45309)),
          ),
          children: [
            const Divider(color: Color(0xFFFDE68A), height: 16),
            _buildStepItem(
              stepNumber: '1',
              title: 'Buka Menu Voucher Saya',
              description: 'Buka aplikasi lalu masuk ke menu "Voucher Saya" untuk memilih voucher aktif Anda.',
              icon: Icons.confirmation_number_rounded,
            ),
            const SizedBox(height: 10),
            _buildStepItem(
              stepNumber: '2',
              title: 'Hubungkan ke WiFi Giganusa',
              description: 'Cari jaringan WiFi di sekitar Anda, temukan yang bernama "Giganusa" dan hubungkan perangkat Anda.',
              icon: Icons.wifi_rounded,
            ),
            const SizedBox(height: 10),
            _buildStepItem(
              stepNumber: '3',
              title: 'Pilih Aktifkan ke WiFi Otomatis',
              description: 'Buka kembali aplikasi dan menu "Voucher Saya", lalu pilih tombol "Aktifkan ke WiFi Otomatis".',
              icon: Icons.touch_app_rounded,
            ),
            const SizedBox(height: 10),
            _buildStepItem(
              stepNumber: '4',
              title: 'Buka Halaman Login',
              description: 'Tekan opsi "Buka Halaman Login" untuk mengarahkan perangkat ke portal otentikasi WiFi.',
              icon: Icons.open_in_browser_rounded,
            ),
            const SizedBox(height: 10),
            _buildStepItem(
              stepNumber: '5',
              title: 'Aktivasi Berhasil & Internetan',
              description: 'Aktivasi selesai! Perangkat Anda kini sudah terhubung dan siap untuk mulai internetan.',
              icon: Icons.check_circle_outline_rounded,
              isLast: true,
            ),
          ],
        ),
      ),
    );
  }

  static Widget _buildStepItem({
    required String stepNumber,
    required String title,
    required String description,
    required IconData icon,
    bool isLast = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFFD97706),
            shape: BoxShape.circle,
          ),
          child: Text(
            stepNumber,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 14, color: const Color(0xFF92400E)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF78350F)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF92400E), height: 1.3),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showGuideDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Row(
          children: const [
            Icon(Icons.help_outline_rounded, color: Color(0xFFD97706), size: 24),
            SizedBox(width: 8),
            Text('Panduan Cara Pakai Voucher', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildStepItem(
                stepNumber: '1',
                title: 'Buka Menu Voucher Saya',
                description: 'Buka aplikasi lalu masuk ke menu "Voucher Saya" untuk memilih voucher aktif Anda.',
                icon: Icons.confirmation_number_rounded,
              ),
              const SizedBox(height: 12),
              _buildStepItem(
                stepNumber: '2',
                title: 'Hubungkan ke WiFi Giganusa',
                description: 'Cari jaringan WiFi di sekitar Anda, temukan yang bernama "Giganusa" dan hubungkan perangkat Anda.',
                icon: Icons.wifi_rounded,
              ),
              const SizedBox(height: 12),
              _buildStepItem(
                stepNumber: '3',
                title: 'Pilih Aktifkan ke WiFi Otomatis',
                description: 'Buka kembali aplikasi dan menu "Voucher Saya", lalu pilih tombol "Aktifkan ke WiFi Otomatis".',
                icon: Icons.touch_app_rounded,
              ),
              const SizedBox(height: 12),
              _buildStepItem(
                stepNumber: '4',
                title: 'Buka Halaman Login',
                description: 'Tekan opsi "Buka Halaman Login" untuk mengarahkan perangkat ke portal otentikasi WiFi.',
                icon: Icons.open_in_browser_rounded,
              ),
              const SizedBox(height: 12),
              _buildStepItem(
                stepNumber: '5',
                title: 'Aktivasi Berhasil & Internetan',
                description: 'Aktivasi selesai! Perangkat Anda kini sudah terhubung dan siap untuk mulai internetan.',
                icon: Icons.check_circle_rounded,
                isLast: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Mengerti', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
          ),
        ],
      ),
    );
  }

  Widget _buildVoucherCard(BuildContext context, CustomerVoucherItem voucher) {
    final usage = voucher.usage;

    // Calculate remaining quota
    final int totalQuotaBytes = voucher.quotaGb * 1073741824; // GB to bytes
    final int usedBytes = usage?.totalBytesUsed ?? 0;
    final int limitFromRouter = usage?.limitBytes ?? 0;
    final int effectiveLimit = limitFromRouter > 0 ? limitFromRouter : totalQuotaBytes;

    final bool isQuotaExhausted = usage?.isQuotaExhausted == true ||
        (effectiveLimit > 0 && (usedBytes >= effectiveLimit || (effectiveLimit - usedBytes) <= 10 * 1024 * 1024));

    final isDisabled = usage?.disabled == true ||
        voucher.status.toLowerCase() == 'disabled' ||
        voucher.status.toLowerCase() == 'suspended' ||
        isQuotaExhausted;
    final statusLower = isDisabled ? 'disabled' : voucher.status.toLowerCase();
    final isActive = statusLower == 'active' && !isQuotaExhausted;
    final isOnline = usage?.isOnline == true && !isDisabled;

    final int remainingBytes = isQuotaExhausted ? 0 : (effectiveLimit - usedBytes).clamp(0, effectiveLimit);
    final double usedPercent = isQuotaExhausted ? 1.0 : (effectiveLimit > 0 ? (usedBytes / effectiveLimit).clamp(0.0, 1.0) : 0.0);

    // 3-tier color system:
    // 🟢 Green  = hotspot benar-benar online (ada active session di MikroTik)
    // 🟣 Primary = voucher masih berlaku / kuota masih ada (status=active, belum online)
    // ⚪ Gray   = voucher habis / kadaluarsa / nonaktif (used, expired, disabled)
    late final Color themeColor;
    late final Color themeDark;
    late final Color themeLight;
    late final Color borderColor;
    late final Color headerBg;
    late final Color headerText;
    late final String statusLabel;

    if (isOnline && isActive) {
      // GREEN — benar-benar sedang online
      themeColor = const Color(0xFF16A34A);
      themeDark = const Color(0xFF15803D);
      themeLight = const Color(0xFFDCFCE7);
      borderColor = const Color(0xFF86EFAC);
      headerBg = const Color(0xFFF0FDF4);
      headerText = const Color(0xFF14532D);
      statusLabel = 'ONLINE';
    } else if (isActive) {
      // PRIMARY — masih berlaku tapi belum online
      themeColor = const Color(0xFF5B50D6);
      themeDark = const Color(0xFF4C40C6);
      themeLight = const Color(0xFFEDE9FE);
      borderColor = const Color(0xFFC4B5FD);
      headerBg = const Color(0xFFF5F3FF);
      headerText = const Color(0xFF3B1F8E);
      statusLabel = 'TERSEDIA';
    } else {
      // GRAY — habis / kadaluarsa / nonaktif
      themeColor = const Color(0xFF94A3B8);
      themeDark = const Color(0xFF64748B);
      themeLight = const Color(0xFFF1F5F9);
      borderColor = const Color(0xFFE2E8F0);
      headerBg = const Color(0xFFF8FAFC);
      headerText = const Color(0xFF475569);
      statusLabel = isQuotaExhausted
          ? 'KUOTA HABIS'
          : (usage?.disabled == true || voucher.status.toLowerCase() == 'disabled' || voucher.status.toLowerCase() == 'suspended')
              ? 'NONAKTIF'
              : statusLower == 'used'
                  ? 'TERPAKAI'
                  : statusLower == 'expired'
                      ? 'KADALUARSA'
                      : voucher.status.toUpperCase();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: borderColor,
          width: isOnline ? 2.0 : isActive ? 1.6 : 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: themeColor.withOpacity(isOnline ? 0.12 : 0.05),
            blurRadius: isOnline ? 16 : 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Header Bar ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: headerBg,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        Icons.signal_cellular_alt_rounded,
                        color: themeColor,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '${voucher.quotaGb} GB Hotspot',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: headerText,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Online pulse badge
                    if (isOnline) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.wifi_rounded, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text(
                              'ONLINE',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: themeLight,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: themeDark,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Kuota & Masa Aktif Info Bar ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: themeLight.withOpacity(0.4),
            ),
            child: Column(
              children: [
                // Quota row
                Row(
                  children: [
                    // Sisa Kuota
                    Expanded(
                      child: Row(
                        children: [
                          Icon(Icons.pie_chart_rounded, size: 14, color: themeColor),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Sisa Kuota', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8))),
                                Text(
                                  usage != null && effectiveLimit > 0
                                      ? VoucherUsageData.formatBytes(remainingBytes)
                                      : '${voucher.quotaGb} GB',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: headerText),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Divider
                    Container(width: 1, height: 28, color: borderColor),
                    const SizedBox(width: 12),
                    // Masa Aktif
                    Expanded(
                      child: Row(
                        children: [
                          Icon(Icons.timer_outlined, size: 14, color: themeColor),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Masa Aktif', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8))),
                                Text(
                                  voucher.validity,
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: headerText),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                // Progress bar (if usage data available)
                if (usage != null && effectiveLimit > 0) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: usedPercent,
                      minHeight: 6,
                      backgroundColor: const Color(0xFFE2E8F0),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        usedPercent > 0.85
                            ? const Color(0xFFEF4444)
                            : usedPercent > 0.6
                                ? const Color(0xFFF59E0B)
                                : themeColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Terpakai: ${VoucherUsageData.formatBytes(usedBytes)}',
                        style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)),
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_downward_rounded, size: 9, color: Color(0xFF3B82F6)),
                          Text(
                            VoucherUsageData.formatBytes(int.tryParse(usage.bytesIn) ?? 0),
                            style: const TextStyle(fontSize: 9, color: Color(0xFF3B82F6), fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.arrow_upward_rounded, size: 9, color: Color(0xFFF59E0B)),
                          Text(
                            VoucherUsageData.formatBytes(int.tryParse(usage.bytesOut) ?? 0),
                            style: const TextStyle(fontSize: 9, color: Color(0xFFF59E0B), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      Text(
                        '${(usedPercent * 100).toStringAsFixed(1)}%',
                        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: themeDark),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          // ── Session & Device Detail Info (only when online) ──
          if (isOnline && usage != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF86EFAC)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withOpacity(0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Device Header: Icon + Device Hostname + Online Indicator
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.smartphone_rounded,
                          size: 16,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF16A34A),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Text(
                                  'PERANGKAT TERHUBUNG',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5,
                                    color: Color(0xFF15803D),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 1),
                            Text(
                              usage.deviceHostname.isNotEmpty
                                  ? usage.deviceHostname
                                  : 'Active Device',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF166534),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1, color: Color(0xFFBBF7D0)),
                  const SizedBox(height: 10),

                  // Detail Grid Items
                  Wrap(
                    runSpacing: 8,
                    spacing: 12,
                    children: [
                      // 1. Waktu Online (Uptime)
                      _buildDeviceDetailChip(
                        icon: Icons.timer_outlined,
                        label: 'Waktu Online',
                        value: usage.sessionUptime.isNotEmpty ? usage.sessionUptime : usage.uptime,
                      ),
                      // 2. MAC Address
                      if (usage.macAddress.isNotEmpty)
                        _buildDeviceDetailChip(
                          icon: Icons.qr_code_rounded,
                          label: 'Alamat MAC',
                          value: usage.macAddress,
                        ),
                      // 3. IP Address
                      if (usage.ipAddress.isNotEmpty)
                        _buildDeviceDetailChip(
                          icon: Icons.lan_outlined,
                          label: 'Alamat IP',
                          value: usage.ipAddress,
                        ),
                      // 4. Total Data Digunakan (Sesi)
                      _buildDeviceDetailChip(
                        icon: Icons.swap_vert_rounded,
                        label: 'Data Digunakan (Sesi)',
                        value: VoucherUsageData.formatBytes(
                          usage.sessionTotal > 0 ? usage.sessionTotal : usage.totalBytesUsed,
                        ),
                      ),
                      // 5. Server Hotspot (Data Pendukung)
                      if (usage.hotspotServer.isNotEmpty)
                        _buildDeviceDetailChip(
                          icon: Icons.dns_outlined,
                          label: 'Server Hotspot',
                          value: usage.hotspotServer,
                        ),
                      // 6. Metode Login (Data Pendukung)
                      if (usage.loginBy.isNotEmpty)
                        _buildDeviceDetailChip(
                          icon: Icons.key_outlined,
                          label: 'Metode Login',
                          value: usage.loginBy.toUpperCase(),
                        ),
                      // 7. Idle Time (Data Pendukung if present)
                      if (usage.idleTime.isNotEmpty && usage.idleTime != '0s')
                        _buildDeviceDetailChip(
                          icon: Icons.hourglass_empty_rounded,
                          label: 'Idle Time',
                          value: usage.idleTime,
                        ),
                    ],
                  ),
                ],
              ),
            ),

          // ── Voucher Code and Details ──
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: themeLight.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: borderColor),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'KODE VOUCHER',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              voucher.voucherCode,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.2,
                                color: headerText,
                              ),
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.copy_rounded, color: themeColor, size: 20),
                        tooltip: 'Salin Kode',
                        onPressed: () => _copyToClipboard(context, voucher.voucherCode),
                      ),
                    ],
                  ),
                ),
                if (voucher.voucherPassword != null && voucher.voucherPassword!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text(
                        'Password: ',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                      Flexible(
                        child: Text(
                          voucher.voucherPassword!,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                // Notes / CID
                if (voucher.notes?.isNotEmpty == true) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.label_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          voucher.notes!,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontStyle: FontStyle.italic),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 2,
                        ),
                      ),
                    ],
                  ),
                ],
                // Activate button (only for active vouchers)
                if (isActive) ...[
                  const SizedBox(height: 14),
                  InkWell(
                    onTap: () => _activateVoucher(context, voucher),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isOnline
                              ? [const Color(0xFF16A34A), const Color(0xFF15803D)]
                              : [const Color(0xFF5B50D6), const Color(0xFF4C40C6)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: themeColor.withOpacity(0.35),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.wifi_lock_rounded, color: Colors.white, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'AKTIFKAN KE WIFI OTOMATIS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 12.5,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceDetailChip({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDCFCE7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: const Color(0xFF16A34A)),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 8.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
              ),
              Text(
                value,
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF14532D), fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
