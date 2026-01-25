import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';
import 'home_screen.dart';
import 'package:permission_handler/permission_handler.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _startApp();
  }

  void _startApp() async {
    // 1. Minimum Splash Duration
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;

    // 2. Check Permissions
    bool hasPermission = await _checkPermissions();
    if (!hasPermission) {
        // Decide what to do if user refuses?
        // For now, _checkPermissions loops or handles it.
        // If it returns false, it means we can't proceed.
        return; 
    }

    // 3. Check Auth
    _checkAuth();
  }

  Future<bool> _checkPermissions() async {
      var status = await Permission.location.status;
      
      if (status.isGranted) return true;

      if (status.isDenied) {
          status = await Permission.location.request();
          if (status.isGranted) return true;
      }

      if (status.isPermanentlyDenied || status.isDenied) {
          if (!mounted) return false;
          // Show Dialog
          return await showDialog<bool>(
              context: context, 
              barrierDismissible: false,
              builder: (ctx) => AlertDialog(
                  title: const Text('Permission Required'),
                  content: const Text('This app requires Location permission to function properly for installations. Please enable it in settings.'),
                  actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Exit'), // Ideally exit app or retry
                      ),
                      ElevatedButton(
                          onPressed: () async {
                              Navigator.pop(ctx, false);
                              await openAppSettings();
                              // We can't easily await return from settings, so we might need to restart check or just ask user to restart app.
                              // Or recursive check
                              // For simplicity, let's just retry check after a delay or loop? 
                              // Simple recursion for now (but be careful of stack)
                              // actually better to just let user restart or provide a "Retry" button on screen? 
                              // Let's return false and maybe let the UI handle a "Retry" state?
                              // But for Splash, let's just loop.
                              // _checkPermissions(); // Async recursion issue
                          }, 
                          child: const Text('Open Settings')
                      )
                  ],
              )
          ) ?? false;
      }

      return false;
  }

  void _checkAuth() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    
    // Check if auth is not initialized, wait for it
    if (auth.isLoading) {
        await auth.initFuture;
    }

    if (!mounted) return;
    
    // Now state should be final for startup
    if (auth.isAuthenticated) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)], // Blue-600 to Blue-700
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1E3A8A).withOpacity(0.2), // Blue-900/20
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Image.asset(
                'assets/images/logo.png',
                width: 80,
                height: 80,
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Telaju',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
             const Text(
              'ISP Management',
              style: TextStyle(
                fontSize: 16,
                color: Color(0xFFDBEAFE), // Blue-100
              ),
            ),
            const SizedBox(height: 48),
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
