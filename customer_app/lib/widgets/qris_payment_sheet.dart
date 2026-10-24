import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/customer_portal_models.dart';
import '../providers/customer_provider.dart';

class QrisPaymentSheet extends StatefulWidget {
  final CustomerInvoice invoice;
  final String qrSvg;
  final String paymentUrl;
  final int amount;
  final String merchantName;
  final String paymentId;

  const QrisPaymentSheet({
    super.key,
    required this.invoice,
    required this.qrSvg,
    required this.paymentUrl,
    required this.amount,
    this.merchantName = 'PT ANDALAN YASA DIGITAL',
    required this.paymentId,
  });

  static Future<void> show(
    BuildContext context, {
    required CustomerInvoice invoice,
    required String qrSvg,
    required String paymentUrl,
    required int amount,
    String merchantName = 'PT ANDALAN YASA DIGITAL',
    required String paymentId,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => QrisPaymentSheet(
        invoice: invoice,
        qrSvg: qrSvg,
        paymentUrl: paymentUrl,
        amount: amount,
        merchantName: merchantName,
        paymentId: paymentId,
      ),
    );
  }

  @override
  State<QrisPaymentSheet> createState() => _QrisPaymentSheetState();
}

class _QrisPaymentSheetState extends State<QrisPaymentSheet> {
  Timer? _pollingTimer;
  bool _isPaid = false;
  bool _isChecking = false;

  @override
  void initState() {
    super.initState();
    // Poll every 4 seconds to check if webhook has marked invoice as PAID
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (timer) async {
      if (!mounted || _isPaid) return;
      await _checkPaymentStatus(silent: true);
    });
  }

  Future<void> _checkPaymentStatus({bool silent = false}) async {
    if (_isPaid) return;

    if (!silent) {
      setState(() => _isChecking = true);
    }

    try {
      final provider = context.read<CustomerProvider>();
      await provider.refreshDashboard();

      final currentInvoice = provider.invoices.firstWhere(
        (inv) => inv.id == widget.invoice.id,
        orElse: () => widget.invoice,
      );

      if (currentInvoice.isPaid) {
        _pollingTimer?.cancel();
        if (mounted) {
          setState(() {
            _isPaid = true;
            _isChecking = false;
          });
        }
      } else {
        if (!silent && mounted) {
          setState(() => _isChecking = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pembayaran belum terdeteksi. Silakan selesaikan pembayaran di m-Banking / e-Wallet Anda.'),
              backgroundColor: Color(0xFFF59E0B),
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (_) {
      if (!silent && mounted) {
        setState(() => _isChecking = false);
      }
    }
  }

  void _copyAmount() {
    Clipboard.setData(ClipboardData(text: widget.amount.toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Nominal Rp ${NumberFormat('#,###', 'id_ID').format(widget.amount)} berhasil disalin!'),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    );

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.92,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: const Row(
                    children: [
                      Text(
                        'QRIS',
                        style: TextStyle(
                          color: Color(0xFF4F46E5),
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          letterSpacing: 1,
                        ),
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Resmi',
                        style: TextStyle(
                          color: Color(0xFF6366F1),
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Pembayaran QRIS',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF1E293B)),
                      ),
                      Text(
                        widget.merchantName,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Content Scrollable
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: _isPaid ? _buildSuccessView() : _buildQrisView(currencyFormatter),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessView() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFA7F3D0), width: 3),
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: Color(0xFF10B981),
              size: 72,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Alhamdulillah, Pembayaran Berhasil!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: Color(0xFF065F46),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tagihan Anda telah lunas dan akun internet Anda otomatis aktif.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text(
                'Selesai & Kembali',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQrisView(NumberFormat currencyFormatter) {
    return Column(
      children: [
        // QR Container
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              // QRIS Top Header Logo
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Image.network(
                    'https://static.xenithpay.com/images/qris.png?v=3',
                    height: 26,
                    errorBuilder: (_, __, ___) => const Text(
                      'QRIS',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.red),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.timer_outlined, size: 12, color: Color(0xFFB45309)),
                        SizedBox(width: 4),
                        Text(
                          '24 Jam',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // SVG QR Code
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(8),
                  child: SvgPicture.string(
                    widget.qrSvg,
                    width: 220,
                    height: 220,
                    fit: BoxFit.contain,
                  ),
                ),
              ),

              const SizedBox(height: 10),
              const Text(
                'NMID: ID1020023456789 • ASPI',
                style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Nominal Card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total yang Harus Dibayar', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  const SizedBox(height: 2),
                  Text(
                    currencyFormatter.format(widget.amount),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              TextButton.icon(
                onPressed: _copyAmount,
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFFF1F5F9),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.copy_rounded, size: 14, color: Color(0xFF334155)),
                label: const Text('Salin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Cara Bayar Card (Humanized Indonesian Guide)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.lightbulb_rounded, size: 18, color: Color(0xFF2563EB)),
                  SizedBox(width: 6),
                  Text(
                    'Cara Bayar Cepat Pakai 1 HP:',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF1E40AF)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _buildStepRow(
                '1',
                'Ambil Screenshot (tangkapan layar) kode QRIS di atas.',
              ),
              _buildStepRow(
                '2',
                'Buka m-Banking (BCA, Mandiri, BRI) atau e-Wallet (DANA, GoPay, OVO, ShopeePay).',
              ),
              _buildStepRow(
                '3',
                'Pilih menu Scan / Bayar QRIS -> Pilih icon Galeri Foto untuk memasukkan gambar screenshot tadi.',
              ),
              _buildStepRow(
                '4',
                'Pastikan penerima adalah ${widget.merchantName} dan nominal sesuai, lalu masukkan PIN Anda.',
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Action Buttons
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isChecking ? null : () => _checkPaymentStatus(silent: false),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 2,
            ),
            child: _isChecking
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.refresh_rounded, size: 18, color: Colors.white),
                      SizedBox(width: 8),
                      Text(
                        'Saya Sudah Bayar (Cek Status)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
          ),
        ),

        const SizedBox(height: 10),

        // Fallback open in browser if customer prefers
        TextButton.icon(
          onPressed: () async {
            final uri = Uri.parse(widget.paymentUrl);
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
          icon: const Icon(Icons.open_in_new, size: 14, color: Color(0xFF64748B)),
          label: const Text(
            'Atau buka halaman web SumoPod',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B), decoration: TextDecoration.underline),
          ),
        ),
      ],
    );
  }

  Widget _buildStepRow(String number, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 18,
            height: 18,
            margin: const EdgeInsets.only(top: 2, right: 8),
            decoration: const BoxDecoration(
              color: Color(0xFF2563EB),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 12, color: Color(0xFF334155), height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
