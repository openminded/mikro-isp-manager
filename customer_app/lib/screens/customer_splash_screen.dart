import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/customer_provider.dart';
import '../widgets/giga_logo_widget.dart';
import 'customer_login_screen.dart';
import 'force_change_password_screen.dart';
import 'main_navigation_screen.dart';

class CustomerSplashScreen extends StatefulWidget {
  const CustomerSplashScreen({super.key});

  @override
  State<CustomerSplashScreen> createState() => _CustomerSplashScreenState();
}

class _CustomerSplashScreenState extends State<CustomerSplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    try {
      final provider = context.read<CustomerProvider>();
      await provider.init().timeout(const Duration(seconds: 3), onTimeout: () {
        debugPrint('[Splash] Init timeout, continuing to login');
      });

      await Future.delayed(const Duration(milliseconds: 800));

      if (!mounted) return;

      if (provider.isAuthenticated) {
        if (provider.mustChangePassword) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const ForceChangePasswordScreen()),
          );
        } else {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
          );
        }
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const CustomerLoginScreen()),
        );
      }
    } catch (e) {
      debugPrint('[Splash] Error during checkAuth: $e');
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const CustomerLoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF5B50D6),
      body: Center(
        child: Container(
          width: 320,
          padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(36),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.25),
                blurRadius: 40,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              GigaLogoWidget(size: 110, showText: true, showSubtitle: true),
              SizedBox(height: 28),
              SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(
                  color: Color(0xFFE53935),
                  strokeWidth: 2.8,
                ),
              ),
              SizedBox(height: 14),
              Text(
                'Memuat Aplikasi Pelanggan...',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
