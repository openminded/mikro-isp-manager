import 'package:flutter/foundation.dart';

class AppConstants {
  static const String _envApiUrl = String.fromEnvironment('API_URL');
  static const String productionApiUrl = 'https://app.telaju.com/api';
  static const String debugApiUrl = 'http://127.0.0.1:3001/api';

  static String get defaultBaseUrl {
    if (_envApiUrl.isNotEmpty) {
      return _envApiUrl;
    }
    return kReleaseMode ? productionApiUrl : debugApiUrl;
  }

  static String get baseUrl {
    final defaultUrl = defaultBaseUrl;
    if (defaultUrl.endsWith('/api')) {
      return defaultUrl.substring(0, defaultUrl.length - 4);
    }
    return defaultUrl;
  }
}
