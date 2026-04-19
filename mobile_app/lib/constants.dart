import 'package:flutter/foundation.dart';

class AppConstants {
  // Use 10.0.2.2 for Android Emulator to access localhost of the host machine.
  // Changes this to your actual local IP if testing on real device.
  // Default to Localhost for Debugging (Emulator)
  // For Web: Use relative path or same-origin to avoid CORS
  static String get baseUrl {
    if (kIsWeb) {
      // Web: Use relative API path (assumes API is on same domain or proxied)
      return '';
    }
    return kReleaseMode ? 'https://werently.telaju.com' : 'http://10.0.2.2:3001';
  }
  static String get defaultBaseUrl => '$baseUrl/api';
}
