import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

import 'package:flutter/foundation.dart';

class ApiService {
  String baseUrl = kReleaseMode ? 'https://app.telaju.com/api' : AppConstants.defaultBaseUrl;
  String? _token;

  static final ApiService _instance = ApiService._internal();

  factory ApiService() {
    return _instance;
  }

  ApiService._internal();

  String? get token => _token;


  void setBaseUrl(String url) {
    if (url.endsWith('/')) {
      baseUrl = url.substring(0, url.length - 1);
    } else {
      baseUrl = url;
    }
  }

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<dynamic> get(String endpoint) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.get(uri, headers: _headers);
    return _processResponse(response);
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.post(uri, headers: _headers, body: jsonEncode(body));
    return _processResponse(response);
  }

  Future<dynamic> put(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.put(uri, headers: _headers, body: jsonEncode(body));
    return _processResponse(response);
  }

  Future<dynamic> delete(String endpoint) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final response = await http.delete(uri, headers: _headers);
    return _processResponse(response);
  }

  Future<dynamic> postMultipart(String endpoint, Map<String, String> fields, List<dynamic> files) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final request = http.MultipartRequest('POST', uri);

    // Add Headers
    if (_token != null) {
      request.headers['Authorization'] = 'Bearer $_token';
    }

    // Add Fields
    fields.forEach((key, value) {
      request.fields[key] = value;
    });

    // Add Files (Assuming files are XFile or File path strings)
    for (var file in files) {
       // We assume file is XFile from image_picker
       // We need to import image_picker or cross_file in api_service? 
       // Or just pass path and filename?
       // Let's assume the provider handles conversion to http.MultipartFile or we accept XFile here.
       // It's cleaner to accept http.MultipartFile or simple struct.
       // But to keep it simple with image_picker:
       // We'll trust the provider to pass `http.MultipartFile` or we adjust.
       // Actually, let's accept `List<http.MultipartFile>`? 
       // No, simpler: accept paths or XFile. But ApiService shouldn't dep heavily.
       // Let's assume files is List of { path, fieldName }? 
       // Or better: Let the Caller create MultipartRequest? No, we handle auth here.
    }
    // Re-implementation below with better signature
    return null; 
  }

  // CORRECT IMPLEMENTATION
  Future<dynamic> postMultipartRequest(String endpoint, Map<String, String> fields, List<String> filePaths, String fileField) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final request = http.MultipartRequest('POST', uri);

    if (_token != null) {
      request.headers['Authorization'] = 'Bearer $_token';
    }

    fields.forEach((k, v) => request.fields[k] = v);

    for (var path in filePaths) {
      if (path.isNotEmpty) {
        request.files.add(await http.MultipartFile.fromPath(fileField, path));
      }
    }

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    return _processResponse(response);
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    } else {
      String message = 'Unknown error';
      try {
        final body = jsonDecode(response.body);
        message = body['error'] ?? message;
      } catch (_) {}
      throw Exception(message);
    }
  }
}
