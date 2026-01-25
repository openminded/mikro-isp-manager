class Customer {
  final String id;
  final String serverId;
  final String serverName;
  final String name; // username
  final String? realName;
  final String? password;
  final String? comment;
  final String profile;
  final String? remoteAddress;
  final String? whatsapp;
  final String? lat;
  final String? long;
  final String? ktp;
  final String? activationDate;
  final List<String> photos;
  final String? subAreaId;
  final bool disabled;
  final String? lastLoggedOut;
  final String? address;

  Customer({
    required this.id,
    required this.serverId,
    required this.serverName,
    required this.name,
    this.realName,
    this.password,
    this.comment,
    required this.profile,
    this.remoteAddress,
    this.whatsapp,
    this.lat,
    this.long,
    this.ktp,
    this.activationDate,
    required this.photos,
    this.subAreaId,
    required this.disabled,
    this.lastLoggedOut,
    this.address,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] ?? '',
      serverId: json['serverId'] ?? '',
      serverName: json['serverName'] ?? '',
      name: json['name'] ?? '',
      realName: json['realName'],
      password: json['password'],
      comment: json['comment'],
      profile: json['profile'] ?? '',
      remoteAddress: json['remote-address'],
      whatsapp: json['whatsapp'],
      lat: json['lat'],
      long: json['long'],
      ktp: json['ktp'],
      activationDate: json['activationDate'],
      photos: (json['photos'] as List?)?.map((e) => e.toString()).toList() ?? [],
      subAreaId: json['sub_area_id'],
      disabled: json['disabled'] ?? false,
      lastLoggedOut: json['last-logged-out'],
      address: json['address'],
    );
  }
}
