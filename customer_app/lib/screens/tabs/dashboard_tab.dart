import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_provider.dart';
import '../../theme/giga_theme.dart';
import '../../widgets/giga_logo_widget.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CustomerProvider>();
    final customer = provider.customer;
    final invoices = provider.invoices;
    final vouchers = provider.vouchers;

    final unpaidInvoices = invoices.where((i) => i.status == 'UNPAID').toList();
    final activeVouchers = vouchers.where((v) => v.status == 'active').toList();

    // Check if customer is disabled, isolated, or has unpaid invoices
    final isBlockedOrUnpaid = customer?.status == 'disabled' ||
        customer?.status == 'isolated' ||
        unpaidInvoices.isNotEmpty;

    final primaryThemeColor = isBlockedOrUnpaid
        ? const Color(0xFFDC2626) // Vibrant Red Theme
        : const Color(0xFF5B50D6); // Original Indigo Purple Theme
    final secondaryThemeColor = isBlockedOrUnpaid
        ? const Color(0xFF991B1B) // Dark Red Theme
        : const Color(0xFF3F37A7);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: primaryThemeColor,
        title: GigaLogoWidget.horizontal(
          height: 26,
          variant: GigaLogoVariant.white,
        ),
        actions: [
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
              // Welcome Card (Dynamic Red or Purple)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [primaryThemeColor, secondaryThemeColor],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: primaryThemeColor.withOpacity(0.35),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Halo, Pelanggan Setia',
                                style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                customer?.realName.isNotEmpty == true ? customer!.realName : (customer?.name ?? 'Konsumen'),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: customer?.status == 'active'
                                ? Colors.green.shade600
                                : (customer?.status == 'disabled' || customer?.status == 'isolated'
                                    ? const Color(0xFFDC2626)
                                    : Colors.amber.shade800),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            customer?.status == 'active'
                                ? '● AKTIF'
                                : (customer?.status == 'disabled'
                                    ? '● TERBLOKIR'
                                    : (customer?.status == 'isolated'
                                        ? '● TERISOLIR'
                                        : '● ${customer?.status.toUpperCase()}')),
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    if (customer?.status == 'disabled' || customer?.status == 'isolated') ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFF87171)),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.info_outline, color: Color(0xFFDC2626), size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Layanan terblokir sementara dikarenakan belum melakukan pembayaran tagihan.',
                                style: TextStyle(color: Color(0xFF991B1B), fontSize: 11.5, fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.speed, color: Colors.amberAccent, size: 26),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Paket Layanan',
                                      style: TextStyle(color: Colors.white70, fontSize: 11),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      customer?.packageProfile ?? 'Standard',
                                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Container(
                            height: 1,
                            color: Colors.white.withOpacity(0.12),
                          ),
                          const SizedBox(height: 10),
                          // WiFi Status row (On-demand reload only, no auto-load)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    provider.wifiStatus == 'online'
                                        ? Icons.wifi_rounded
                                        : (provider.wifiStatus == 'offline' ? Icons.wifi_off_rounded : Icons.wifi_find_rounded),
                                    size: 18,
                                    color: provider.wifiStatus == 'online'
                                        ? const Color(0xFF4ADE80)
                                        : (provider.wifiStatus == 'offline' ? const Color(0xFFF87171) : Colors.white70),
                                  ),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Text(
                                            'Status WiFi: ',
                                            style: TextStyle(color: Colors.white70, fontSize: 11),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: provider.wifiStatus == 'online'
                                                  ? const Color(0xFF16A34A).withOpacity(0.3)
                                                  : (provider.wifiStatus == 'offline'
                                                      ? const Color(0xFFDC2626).withOpacity(0.3)
                                                      : Colors.white.withOpacity(0.1)),
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(
                                                color: provider.wifiStatus == 'online'
                                                    ? const Color(0xFF4ADE80)
                                                    : (provider.wifiStatus == 'offline'
                                                        ? const Color(0xFFF87171)
                                                        : Colors.white30),
                                                width: 0.8,
                                              ),
                                            ),
                                            child: Text(
                                              provider.wifiLabel ?? 'Belum dicek',
                                              style: TextStyle(
                                                color: provider.wifiStatus == 'online'
                                                    ? const Color(0xFF86EFAC)
                                                    : (provider.wifiStatus == 'offline'
                                                        ? const Color(0xFFFCA5A5)
                                                        : Colors.white),
                                                fontSize: 10.5,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (provider.wifiCheckedAt != null)
                                        Text(
                                          'Dicek pukul ${provider.wifiCheckedAt}',
                                          style: const TextStyle(color: Colors.white54, fontSize: 9.5),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                              // Tombol Reload Status WiFi
                              InkWell(
                                onTap: provider.isCheckingWifi
                                    ? null
                                    : () {
                                        provider.checkWifiStatus();
                                      },
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.18),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white24, width: 0.8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (provider.isCheckingWifi)
                                        const SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                          ),
                                        )
                                      else
                                        const Icon(Icons.refresh_rounded, color: Colors.white, size: 14),
                                      const SizedBox(width: 5),
                                      Text(
                                        provider.isCheckingWifi ? 'Mengecek...' : 'Cek Status',
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          // Detail Uptime & Usage (Muncul setelah dicek)
                          if (provider.wifiStatus != null) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.white12, width: 0.8),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Row(
                                      children: [
                                        const Icon(Icons.data_usage_rounded, color: Color(0xFF67E8F9), size: 16),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'Total Pemakaian',
                                                style: TextStyle(color: Colors.white60, fontSize: 9.5),
                                              ),
                                              Text(
                                                provider.wifiUsage ?? (provider.wifiStatus == 'online' ? 'Aktif' : '0 B'),
                                                style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    width: 1,
                                    height: 24,
                                    color: Colors.white24,
                                    margin: const EdgeInsets.symmetric(horizontal: 8),
                                  ),
                                  Expanded(
                                    child: Row(
                                      children: [
                                        const Icon(Icons.timer_outlined, color: Color(0xFFFDE047), size: 16),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text(
                                                'Uptime WiFi',
                                                style: TextStyle(color: Colors.white60, fontSize: 9.5),
                                              ),
                                              Text(
                                                provider.wifiUptime ?? (provider.wifiStatus == 'online' ? 'Aktif' : '-'),
                                                style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
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
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Quick Status Counters
              Row(
                children: [
                  Expanded(
                    child: _buildSummaryCard(
                      title: 'Voucher Kuota',
                      count: '${activeVouchers.length}',
                      subtitle: 'Voucher Tersedia',
                      icon: Icons.confirmation_number_rounded,
                      color: const Color(0xFF0EA5E9),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildSummaryCard(
                      title: 'Tagihan Belum Lunas',
                      count: '${unpaidInvoices.length}',
                      subtitle: unpaidInvoices.isEmpty ? 'Semua Lunas' : 'Perlu Dibayar',
                      icon: Icons.receipt_long_rounded,
                      color: unpaidInvoices.isEmpty ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Detail Paket & Layanan Section
              const Text(
                'Detail Layanan Pelanggan',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    _buildInfoRow(
                      icon: Icons.person_outline,
                      label: 'Nama Pelanggan (Konsumen)',
                      value: (customer?.realName?.isNotEmpty == true ? customer!.realName : customer?.name) ?? '-',
                    ),
                    const Divider(height: 20),
                    _buildInfoRow(
                      icon: Icons.phone_android_outlined,
                      label: 'No. Handphone / WhatsApp',
                      value: customer?.phoneNumber ?? '-',
                    ),
                    const Divider(height: 20),
                    _buildInfoRow(
                      icon: Icons.home_outlined,
                      label: 'Alamat Pemasangan (Server & Sub Area)',
                      value: customer?.address?.isNotEmpty == true ? customer!.address! : 'Sesuai registrasi',
                    ),
                    const Divider(height: 20),
                    _buildInfoRow(
                      icon: Icons.calendar_today_outlined,
                      label: 'Tanggal Aktivasi',
                      value: (customer?.activationDate?.isNotEmpty == true ? customer!.activationDate! : 'Aktif'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Voucher Highlight
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Voucher Kuota Terbaru',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                  ),
                  Text(
                    '${vouchers.length} Total',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (vouchers.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Center(
                    child: Column(
                      children: const [
                        Icon(Icons.airplane_ticket_outlined, size: 40, color: Color(0xFFCBD5E1)),
                        SizedBox(height: 8),
                        Text(
                          'Belum ada voucher kuota yang dibagikan',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...vouchers.take(2).map((v) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.wifi, color: Color(0xFFE53935)),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Voucher Kuota ${v.quotaGb} GB',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Kode: ${v.voucherCode}',
                                  style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontFamily: 'monospace'),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: v.status == 'active' ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              v.status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: v.status == 'active' ? const Color(0xFF166534) : const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required String count,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            count,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, size: 20, color: const Color(0xFF64748B)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
