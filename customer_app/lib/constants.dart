import 'package:flutter/foundation.dart';

class AppConstants {
  /// Base API URL Production untuk Customer App.
  /// Secara default di Release Mode menggunakan https://app.telaju.com/api
  /// Dapat di-override via parameter build:
  /// flutter build apk --release --dart-define=API_URL=https://app.telaju.com/api
  static const String _envApiUrl = String.fromEnvironment('API_URL');
  
  static const String productionApiUrl = 'https://app.telaju.com/api';
  static const String debugApiUrl = 'http://127.0.0.1:3001/api';

  static String get defaultApiUrl {
    if (_envApiUrl.isNotEmpty) {
      return _envApiUrl;
    }
    return kReleaseMode ? productionApiUrl : debugApiUrl;
  }

  static const String appName = 'GigaNusa';
  static const String appVersion = '1.0.0';
  static const String defaultPassword = 'nusantara!';
}
