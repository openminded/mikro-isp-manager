import 'package:flutter/foundation.dart';

class AppConstants {
  // Use 10.0.2.2 for Android Emulator to access localhost of the host machine.
  // Changes this to your actual local IP if testing on real device.
  // Default to Localhost for Debugging (Emulator)
  // For Web: Use relative path or same-origin to avoid CORS
  static String get baseUrl {
    if (kIsWeb) {
      // In production (PWA.telaju.com), it should point to the backend domain
      // If we use relative paths, it assumes backend is on same domain. 
      // User has app.telaju.com for backend.
      return kReleaseMode ? 'https://app.telaju.com' : 'http://localhost:3001';
    }
    return kReleaseMode ? 'https://app.telaju.com' : 'http://10.0.2.2:3001';
  }
  static String get defaultBaseUrl => '$baseUrl/api';
}
