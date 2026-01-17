class Employee {
  final String id;
  final String name;
  final String phoneNumber;
  final String jobTitleId;
  final String? ttl;
  final String? nik;
  final String? photoUrl;

  Employee({
    required this.id,
    required this.name,
    required this.phoneNumber,
    required this.jobTitleId,
    this.ttl,
    this.nik,
    this.photoUrl,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      jobTitleId: json['jobTitleId'] ?? '',
      ttl: json['ttl'],
      nik: json['nik'],
      photoUrl: json['photoUrl'],
    );
  }
}
