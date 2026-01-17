import 'package:flutter/material.dart';
import '../models/user.dart';
import '../models/employee.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  User? _user;
  Employee? _employee;
  String? _jobTitleName;
  bool _isLoading = true;

  User? get user => _user;
  Employee? get employee => _employee;
  String? get jobTitleName => _jobTitleName;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _init();
  }

  Future<void> _init() async {
    _user = await _authService.getCurrentUser();
    if (_user != null && _user!.employeeId != null) {
      await _fetchTyEmployeeDetails(_user!.employeeId!);
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();
    try {
      _user = await _authService.login(username, password);
      if (_user != null && _user!.employeeId != null) {
        await _fetchTyEmployeeDetails(_user!.employeeId!);
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    _user = null;
    _employee = null;
    _jobTitleName = null;
    notifyListeners();
  }

  Future<void> reloadEmployeeDetails() async {
    if (_user != null && _user!.employeeId != null) {
      await _fetchTyEmployeeDetails(_user!.employeeId!);
      notifyListeners();
    }
  }

  Future<void> _fetchTyEmployeeDetails(String employeeId) async {
    try {
      final ApiService api = ApiService();
      
      // Fetch Employees
      // Note: Server only supports GET /api/employees (list all)
      final employeesData = await api.get('/employees');
      if (employeesData is List) {
        final empJson = employeesData.firstWhere((e) => e['id'] == employeeId, orElse: () => null);
        if (empJson != null) {
          _employee = Employee.fromJson(empJson);
          
          // Fetch Job Titles to resolve name
          if (_employee!.jobTitleId.isNotEmpty) {
             final jobsData = await api.get('/job-titles');
             if (jobsData is List) {
               final job = jobsData.firstWhere((j) => j['id'] == _employee!.jobTitleId, orElse: () => null);
               if (job != null) {
                 _jobTitleName = job['name'];
               }
             }
          }
        }
      }
    } catch (e) {
      print('Failed to fetch employee details: $e');
    }
  }
}

