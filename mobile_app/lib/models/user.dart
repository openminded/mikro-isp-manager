class User {
  final String id;
  final String username;
  final String role;
  final String name;
  final String? employeeId;

  User({
    required this.id,
    required this.username,
    required this.role,
    required this.name,
    this.employeeId,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      role: json['role'] ?? '',
      name: json['name'] ?? '',
      employeeId: json['employeeId'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'name': name,
      'employeeId': employeeId,
    };
  }
}
