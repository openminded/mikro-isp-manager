import 'package:flutter/foundation.dart';

class AppConstants {
  // Use 10.0.2.2 for Android Emulator to access localhost of the host machine.
  // Changes this to your actual local IP if testing on real device.
  // Default to Localhost for Debugging (Emulator)
  static String get baseUrl => kReleaseMode ? 'https://app.telaju.com' : 'http://10.0.2.2:3001';
  static String get defaultBaseUrl => '$baseUrl/api';
}
