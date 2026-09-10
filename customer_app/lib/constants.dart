import 'package:flutter/foundation.dart';

class AppConstants {
  // Configurable base URL for customer app
  static String get defaultApiUrl {
    if (kDebugMode) {
      return 'http://localhost:3001/api';
    }
    return 'https://app.telaju.com/api';
  }

  static const String appName = 'GigaNusa';
  static const String appVersion = '1.0.0';
  static const String defaultPassword = 'nusantara!';
}
