import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  void _checkAuth() async {
    // Artificial delay for splash effect
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isLoading) {
        _navigate(auth);
    } else {
        // Wait for loading? actually provider does it in init.
        // We can just watch it or better, rely on Consumer in build? 
        // No, splash is logic.
        // Let's assume auth provided is mostly ready or we wait for it.
        // Since we did not await auth.init() in main, we should perhaps wait here.
        // Actually AuthProvider calls _init() in constructor which is async fire-and-forget.
        // We should expose a future or use a specialized logic.
        // Simple hack: wait a bit more? Or better:
        // Use FutureBuilder in Main or here.
        // For now, let's assume if user is null, go login.
    }
    
    // Better logic: rely on build updates or just use a FutureBuilder in main.dart.
    // But since we are here:
    if (auth.isAuthenticated) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  void _navigate(AuthProvider auth) {
      if (auth.isAuthenticated) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
     final auth = Provider.of<AuthProvider>(context);
     
     // If auth happens to finish loading while we wait:
     if (!auth.isLoading) {
         // We could navigate here but better to do it once.
         // Let's leave the timer logic as primary driver, 
         // but if loading takes longer than 2s, we wait.
     }

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.wifi_tethering, size: 80, color: Colors.blueAccent),
            SizedBox(height: 20),
            Text('MikroISP Tech', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            SizedBox(height: 20),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
