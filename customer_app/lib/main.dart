import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/customer_provider.dart';
import 'screens/customer_splash_screen.dart';
import 'theme/giga_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GiganusaApp());
}

class GiganusaApp extends StatelessWidget {
  const GiganusaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CustomerProvider()),
      ],
      child: MaterialApp(
        title: 'Giganusa',
        theme: GigaTheme.theme,
        home: const CustomerSplashScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
