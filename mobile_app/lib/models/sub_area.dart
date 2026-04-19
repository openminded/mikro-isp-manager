class SubArea {
  final String id;
  final String name;
  final String serverId;
  final String? description;

  SubArea({
    required this.id,
    required this.name,
    required this.serverId,
    this.description,
  });

  factory SubArea.fromJson(Map<String, dynamic> json) {
    return SubArea(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      serverId: json['serverId'] ?? '',
      description: json['description'],
    );
  }
}
