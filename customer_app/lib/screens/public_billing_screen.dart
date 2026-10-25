import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../constants.dart';
import '../models/customer_portal_models.dart';
import '../widgets/qris_payment_sheet.dart';

class PublicBillingScreen extends StatefulWidget {
  final String? initialPhone;

  const PublicBillingScreen({super.key, this.initialPhone});

  @override
  State<PublicBillingScreen> createState() => _PublicBillingScreenState();
}

class _PublicBillingScreenState extends State<PublicBillingScreen> {
  final TextEditingController _phoneController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _billingData;

  @override
  void initState() {
    super.initState();
    if (widget.initialPhone != null && widget.initialPhone!.isNotEmpty) {
      _phoneController.text = widget.initialPhone!;
      _checkBilling();
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _checkBilling() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      setState(() => _errorMessage = 'Silakan masukkan nomor WhatsApp / HP Anda');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final uri = Uri.parse('${AppConstants.defaultApiUrl}/public/billing/check');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone}),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
        setState(() {
          _billingData = data;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['error'] ?? 'Nomor tidak terdaftar atau gagal memeriksa tagihan.';
          _billingData = null;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
        _isLoading = false;
      });
    }
  }

  Future<void> _payInvoice(Map<String, dynamic> invMap) async {
    final invoiceId = invMap['id']?.toString() ?? '';
    final phone = _phoneController.text.trim();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: Color(0xFF10B981)),
                SizedBox(height: 16),
                Text(
                  'Menyiapkan Pembayaran QRIS...',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final uri = Uri.parse('${AppConstants.defaultApiUrl}/public/billing/create-qris');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'invoiceId': invoiceId,
          'phone': phone,
        }),
      ).timeout(const Duration(seconds: 20));

      if (mounted) Navigator.of(context).pop();

      final data = jsonDecode(res.body);
      if (res.statusCode >= 200 && res.statusCode < 300 && data['success'] == true) {
        final dummyInvoice = CustomerInvoice(
          id: invoiceId,
          period: invMap['period']?.toString() ?? '-',
          amount: double.tryParse(invMap['amount']?.toString() ?? '0') ?? 0.0,
          status: 'UNPAID',
          dueDate: invMap['due_date']?.toString() ?? '-',
        );

        final qrSvg = data['qr_svg'];
        final paymentUrl = data['payment_link_url']?.toString() ?? '';
        final amount = (data['amount'] is num) ? (data['amount'] as num).toInt() : dummyInvoice.amount.toInt();
        final paymentId = data['payment_id']?.toString() ?? '';

        if (mounted && qrSvg != null && qrSvg.toString().isNotEmpty) {
          await QrisPaymentSheet.show(
            context,
            invoice: dummyInvoice,
            qrSvg: qrSvg.toString(),
            paymentUrl: paymentUrl,
            amount: amount,
            merchantName: 'Kanal Resmi QRIS Nasional',
            paymentId: paymentId,
          );

          // Re-check after sheet closes to refresh status
          _checkBilling();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['error'] ?? 'Gagal membuat QRIS'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'id_ID',
      symbol: 'Rp ',
      decimalDigits: 0,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Cek & Bayar Tagihan',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Periksa Tagihan WiFi Tanpa Login',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Masukkan nomor WhatsApp / HP yang terdaftar untuk melihat tagihan dan membayar langsung via QRIS resmi.',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B), height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.phone_android_rounded, color: Color(0xFF4F46E5)),
                      hintText: 'Contoh: 081234567890',
                      labelText: 'Nomor WhatsApp / HP',
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF4F46E5), width: 2),
                      ),
                    ),
                    onSubmitted: (_) => _checkBilling(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _checkBilling,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 2,
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                            )
                          : const Text(
                              'Periksa Tagihan',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                    ),
                  ),
                ],
              ),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(fontSize: 12.5, color: Color(0xFF991B1B), height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (_billingData != null) ...[
              const SizedBox(height: 20),
              _buildResultView(currencyFormatter),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildResultView(NumberFormat currencyFormatter) {
    final cust = _billingData!['customer'] as Map<String, dynamic>? ?? {};
    final invoices = (_billingData!['invoices'] as List?) ?? [];
    final unpaidInvoices = invoices.where((i) => (i['status'] ?? '').toString().toUpperCase() == 'UNPAID').toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Masked Customer Info Card
        Container(
          padding: const EdgeInsets.all(16),
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
                  Text(
                    cust['masked_name'] ?? 'Pelanggan',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    cust['masked_phone'] ?? '',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  cust['package_profile'] ?? 'Paket WiFi',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF4F46E5)),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Unpaid or All Paid banner
        if (unpaidInvoices.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: const Column(
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 48),
                SizedBox(height: 12),
                Text(
                  'Semua Tagihan Sudah Lunas!',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF065F46)),
                ),
                SizedBox(height: 6),
                Text(
                  'Tidak ada tagihan tertunggak saat ini. Layanan internet Anda aktif lancar.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF047857), height: 1.4),
                ),
              ],
            ),
          )
        else ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, color: Color(0xFFB45309), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Terdapat ${unpaidInvoices.length} tagihan belum dibayar. Silakan lakukan pembayaran via QRIS.',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ...unpaidInvoices.map((inv) => _buildInvoiceCard(inv, currencyFormatter)),
        ],
      ],
    );
  }

  Widget _buildInvoiceCard(Map<String, dynamic> inv, NumberFormat currencyFormatter) {
    final amount = (inv['amount'] is num) ? (inv['amount'] as num).toDouble() : 0.0;
    final period = inv['period'] ?? '-';
    final dueDate = inv['due_date'] ?? '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECACA)),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withOpacity(0.04),
            blurRadius: 10,
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
                'Tagihan Periode $period',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'BELUM LUNAS',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Jatuh Tempo: $dueDate',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Text(
            currencyFormatter.format(amount),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _payInvoice(inv),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.qr_code_rounded, color: Colors.white, size: 18),
              label: const Text(
                'Bayar via QRIS Sekarang',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
