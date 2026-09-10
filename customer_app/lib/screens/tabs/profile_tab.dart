import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_provider.dart';
import '../../widgets/giga_logo_widget.dart';
import '../customer_login_screen.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  void _showChangePasswordDialog(BuildContext context) {
    final provider = context.read<CustomerProvider>();
    final oldPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();
    bool obscure = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Text('Ganti Kata Sandi'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: oldPasswordController,
                obscureText: obscure,
                decoration: const InputDecoration(
                  labelText: 'Kata Sandi Saat Ini',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newPasswordController,
                obscureText: obscure,
                decoration: const InputDecoration(
                  labelText: 'Kata Sandi Baru (Min. 5 karakter)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPasswordController,
                obscureText: obscure,
                decoration: const InputDecoration(
                  labelText: 'Ulangi Kata Sandi Baru',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Checkbox(
                    value: !obscure,
                    onChanged: (val) => setModalState(() => obscure = !val!),
                  ),
                  const Text('Tampilkan Sandi', style: TextStyle(fontSize: 12)),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () async {
                final oldPwd = oldPasswordController.text.trim();
                final newPwd = newPasswordController.text.trim();
                final confPwd = confirmPasswordController.text.trim();

                if (newPwd.length < 5) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Kata sandi baru minimal 5 karakter')),
                  );
                  return;
                }

                if (newPwd != confPwd) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Konfirmasi kata sandi tidak cocok')),
                  );
                  return;
                }

                final success = await provider.changePassword(
                  oldPassword: oldPwd,
                  newPassword: newPwd,
                );

                if (ctx.mounted) Navigator.pop(ctx);

                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Kata sandi berhasil diubah!'), backgroundColor: Colors.green),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(provider.errorMessage ?? 'Gagal mengubah kata sandi'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
  }

  void _handleLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Keluar dari Akun?'),
        content: const Text('Anda harus masuk kembali menggunakan nomor handphone Anda.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935)),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await context.read<CustomerProvider>().logout();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const CustomerLoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CustomerProvider>();
    final customer = provider.customer;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Profil Saya', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Profile Header Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
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
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: const Color(0xFFEFF6FF),
                    child: const Icon(Icons.person, size: 40, color: Color(0xFF3B82F6)),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    customer?.realName.isNotEmpty == true ? customer!.realName : (customer?.name ?? 'Konsumen'),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    customer?.phoneNumber ?? '-',
                    style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Pelanggan GigaNusa',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Consumer Data List (Strictly no mikrotik router details)
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildListTile(
                    icon: Icons.badge_outlined,
                    title: 'Nama Pelanggan',
                    subtitle: customer?.name ?? '-',
                  ),
                  const Divider(height: 1),
                  _buildListTile(
                    icon: Icons.account_circle_outlined,
                    title: 'Nama Konsumen (KTP)',
                    subtitle: customer?.realName ?? '-',
                  ),
                  const Divider(height: 1),
                  _buildListTile(
                    icon: Icons.phone_outlined,
                    title: 'Nomor WhatsApp / HP',
                    subtitle: customer?.phoneNumber ?? '-',
                  ),
                  const Divider(height: 1),
                  _buildListTile(
                    icon: Icons.location_on_outlined,
                    title: 'Alamat Pemasangan',
                    subtitle: customer?.address?.isNotEmpty == true ? customer!.address! : 'Sesuai data registrasi',
                  ),
                  const Divider(height: 1),
                  _buildListTile(
                    icon: Icons.speed,
                    title: 'Paket Internet',
                    subtitle: customer?.packageProfile ?? 'Standard',
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Security & Settings
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_outline, color: Color(0xFF334155)),
                    title: const Text('Ganti Kata Sandi', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    trailing: const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
                    onTap: () => _showChangePasswordDialog(context),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.info_outline, color: Color(0xFF334155)),
                    title: const Text('Tentang GigaNusa', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: const Text('Versi 1.0.0', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: () => _handleLogout(context),
                icon: const Icon(Icons.logout, color: Color(0xFFE53935)),
                label: const Text(
                  'Keluar dari Aplikasi',
                  style: TextStyle(color: Color(0xFFE53935), fontWeight: FontWeight.bold, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFFCA5A5)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListTile({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return ListTile(
      leading: Icon(icon, color: const Color(0xFF64748B), size: 22),
      title: Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
      ),
    );
  }
}
