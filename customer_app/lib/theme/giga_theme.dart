import 'package:flutter/material.dart';

class GigaTheme {
  // Primary brand palette from the login hotspot screen
  static const Color backgroundPurple = Color(0xFF5B50D6); // Vibrant Indigo / Purple backdrop
  static const Color backgroundPurpleDark = Color(0xFF4C40C6);
  static const Color accentRed = Color(0xFFE53935); // Key / Masuk Action Red
  static const Color accentRedDark = Color(0xFFD32F2F);
  static const Color slateArch = Color(0xFF323746); // Dark Arch slate
  static const Color cardWhite = Colors.white;
  static const Color textDark = Color(0xFF1E293B);
  static const Color textMuted = Color(0xFF64748B);
  static const Color borderLight = Color(0xFFE2E8F0);

  // Status colors
  static const Color successGreen = Color(0xFF10B981);
  static const Color warningOrange = Color(0xFFF59E0B);
  static const Color infoBlue = Color(0xFF3B82F6);

  static ThemeData get theme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      colorScheme: ColorScheme.fromSeed(
        seedColor: backgroundPurple,
        primary: backgroundPurple,
        secondary: accentRed,
        surface: cardWhite,
      ),
      fontFamily: 'Roboto',
      appBarTheme: const AppBarTheme(
        backgroundColor: backgroundPurple,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
    );
  }
}
