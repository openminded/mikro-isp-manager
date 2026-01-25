class Server {
  final String id;
  final String name;
  final String ip;
  final String username;
  final String? password; // Only needed if we use it, but typically we just need ID/Name for finding correct server to proxy to.
  final int? port;

  Server({
    required this.id,
    required this.name,
    required this.ip,
    required this.username,
    this.password,
    this.port,
    this.installationCosts = const [],
  });

  final List<InstallationCostType> installationCosts;

  factory Server.fromJson(Map<String, dynamic> json) {
    return Server(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      ip: json['ip'] ?? '',
      username: json['username'] ?? '',
      password: json['password'],
      port: json['port'],
      installationCosts: (json['installation_costs'] as List<dynamic>?)
          ?.map((e) => InstallationCostType.fromJson(e))
          .toList() ?? [],
    );
  }
}

class InstallationCostType {
  final String name;
  final num price;

  InstallationCostType({required this.name, required this.price});

  factory InstallationCostType.fromJson(Map<String, dynamic> json) {
    return InstallationCostType(
      name: json['name'] ?? '',
      price: json['price'] ?? 0,
    );
  }
}
