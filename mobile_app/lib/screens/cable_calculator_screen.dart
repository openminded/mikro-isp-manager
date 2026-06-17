import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CableCalculatorScreen extends StatefulWidget {
  const CableCalculatorScreen({super.key});

  @override
  State<CableCalculatorScreen> createState() => _CableCalculatorScreenState();
}

class _CableCalculatorScreenState extends State<CableCalculatorScreen> {
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();

  double _totalLength = 0;
  double _cost = 0;
  String _details = '';
  bool _isValid = false;

  void _calculate() {
    final startText = _startController.text;
    final endText = _endController.text;

    if (startText.isEmpty || endText.isEmpty) {
      setState(() {
        _isValid = false;
        _details = '';
      });
      return;
    }

    final startNum = double.tryParse(startText);
    final endNum = double.tryParse(endText);

    if (startNum != null && endNum != null) {
      if (startNum >= endNum) {
        _isValid = true;
        _totalLength = startNum - endNum;
        if (_totalLength <= 200) {
          _cost = 0;
          _details = "Total kabel <= 200 meter (Gratis)";
        } else if (_totalLength <= 600) {
          _cost = (_totalLength - 200) * 3000;
          _details = "${_totalLength.toInt()}m - 200m (gratis) = ${(_totalLength - 200).toInt()}m x Rp 3.000";
        } else {
          _cost = (_totalLength - 200) * 2500;
          _details = "${_totalLength.toInt()}m - 200m (gratis) = ${(_totalLength - 200).toInt()}m x Rp 2.500";
        }
      } else {
        _isValid = false;
        _details = "Kabel Start harus lebih besar atau sama dengan Kabel End";
      }
      setState(() {});
    }
  }

  @override
  void initState() {
    super.initState();
    _startController.addListener(_calculate);
    _endController.addListener(_calculate);
  }

  @override
  void dispose() {
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kalkulator Kabel', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF3949AB), Color(0xFF283593)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Masukkan angka pada meteran kabel untuk menghitung estimasi biaya tarikan ke rumah pelanggan.',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _startController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Angka Meteran Start (Awal)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.cable),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _endController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Angka Meteran End (Di Pelanggan)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.cable),
              ),
            ),
            const SizedBox(height: 24),
            if (_isValid && _totalLength > 600 && _totalLength < 720)
              Container(
                margin: const EdgeInsets.only(bottom: 24),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  border: Border.all(color: Colors.orange.shade200),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, color: Colors.orange.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Info: Karena panjang kabel melewati 600m (masuk tarif Rp 2.500/m), secara nominal total biayanya mungkin terlihat lebih murah dibandingkan pas di panjang 600m. Ini efek normal dari struktur tarif.',
                        style: TextStyle(color: Colors.orange.shade900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'HASIL PERHITUNGAN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Panjang', style: TextStyle(color: Colors.black54, fontWeight: FontWeight.w500)),
                        Text(
                          _isValid ? '${_totalLength.toInt()} Meter' : '-',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _isValid ? Colors.black87 : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 30),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Rincian', style: TextStyle(color: Colors.black54, fontWeight: FontWeight.w500)),
                        const SizedBox(width: 20),
                        Expanded(
                          child: Text(
                            _details.isEmpty ? '-' : _details,
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              fontSize: 14,
                              color: _isValid ? Colors.black87 : Colors.red,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 30),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Biaya', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        Text(
                          _isValid ? currencyFormatter.format(_cost) : '-',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: _isValid 
                                ? (_cost > 0 ? Colors.green.shade700 : Colors.blue.shade700) 
                                : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
