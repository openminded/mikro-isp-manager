import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'home_screen.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _urlController = TextEditingController(text: ApiService().baseUrl);
  bool _showSettings = false;

  void _handleLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter credentials')));
      return;
    }
    
    // Update Base URL if changed
    if (_urlController.text.isNotEmpty) {
        ApiService().setBaseUrl(_urlController.text.trim());
    }

    try {
      await auth.login(username, password);
      // create_ticket logic
      if (!mounted) return;
      if (auth.isAuthenticated) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/images/logo.png', height: 100),
                  const SizedBox(height: 16),
                  const Text(
                    'Welcome Back',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Sign in to access your technician dashboard',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 48),
                  
                  TextField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  
                  if (_showSettings) ...[
                      const SizedBox(height: 16),
                      TextField(
                        controller: _urlController,
                        decoration: const InputDecoration(
                          labelText: 'Server URL',
                          prefixIcon: Icon(Icons.link),
                          border: OutlineInputBorder(),
                          helperText: 'e.g. https://app.telaju.com/api'
                        ),
                      ),
                  ],

                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: auth.isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: auth.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Login', style: TextStyle(fontSize: 16)),
                  ),
                  
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () {
                        setState(() {
                            _showSettings = !_showSettings;
                        });
                    },
                    child: Text(_showSettings ? 'Hide Server Settings' : 'Server Settings'),
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
