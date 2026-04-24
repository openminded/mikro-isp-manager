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
  final String? installationDate;
  final String? ssidName;
  final String? ssidPassword;
  final String? signalLevel;

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
    this.installationDate,
    this.ssidName,
    this.ssidPassword,
    this.signalLevel,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id']?.toString() ?? '',
      serverId: json['serverId']?.toString() ?? '',
      serverName: json['serverName']?.toString() ?? 'Unknown',
      name: json['name']?.toString() ?? '',
      realName: json['realName']?.toString() ?? '',
      password: json['password']?.toString(),
      comment: json['comment']?.toString() ?? '',
      profile: json['profile']?.toString() ?? 'default',
      remoteAddress: json['remote-address']?.toString() ?? '-',
      whatsapp: json['whatsapp']?.toString() ?? '',
      lat: json['lat']?.toString() ?? '',
      long: json['long']?.toString() ?? '',
      ktp: json['ktp']?.toString() ?? '',
      activationDate: json['activationDate']?.toString(),
      photos: (json['photos'] as List?)?.map((e) => e.toString()).toList() ?? [],
      subAreaId: json['sub_area_id']?.toString(),
      disabled: json['disabled'] == true || json['disabled'] == 'true',
      lastLoggedOut: json['last-logged-out']?.toString() ?? '-',
      address: json['address']?.toString() ?? '-',
      installationDate: json['installationDate']?.toString(),
      ssidName: json['ssidName']?.toString(),
      ssidPassword: json['ssidPassword']?.toString(),
      signalLevel: json['signalLevel']?.toString(),
    );
  }
}
