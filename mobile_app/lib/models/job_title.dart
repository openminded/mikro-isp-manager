class JobTitle {
  final String id;
  final String name;

  JobTitle({required this.id, required this.name});

  factory JobTitle.fromJson(Map<String, dynamic> json) {
    return JobTitle(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
    );
  }
}
