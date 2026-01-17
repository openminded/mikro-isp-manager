import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();

  Future<User> login(String username, String password) async {
    final result = await _api.post('/auth/login', {
      'username': username,
      'password': password,
    });

    final token = result['token'];
    final userJson = result['user'];

    await _api.setToken(token);
    return User.fromJson(userJson);
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout', {'token': _api.token}); 
    } catch (_) {
      // Ignore logout errors
    }
    await _api.setToken(null);
  }

  Future<User?> getCurrentUser() async {
    try {
      if (_api.token == null) await _api.loadToken();
      if (_api.token == null) return null;


      final result = await _api.get('/auth/me');
      final userJson = result['user'];
      return User.fromJson(userJson);
    } catch (e) {
      // If token invalid, clear it
      await _api.setToken(null);
      return null;
    }
  }
}
