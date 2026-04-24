class Registration {
  final String id;
  final String fullName;
  final String phoneNumber;
  final String address;
  final String locationId; // Server Name often
  final String status;
  final String workingOrderStatus;
  final String? workingOrderNote;
  final Installation? installation;
  final String createdAt;
  final String? mapsUrl;
  final String? subAreaId;

  Registration({
    required this.id,
    required this.fullName,
    required this.phoneNumber,
    required this.address,
    required this.locationId,
    required this.status,
    required this.workingOrderStatus,
    this.workingOrderNote,
    this.installation,
    required this.createdAt,
    this.mapsUrl,
    this.subAreaId,
  });

  factory Registration.fromJson(Map<String, dynamic> json) {
    return Registration(
      id: json['id'] ?? '',
      fullName: json['fullName'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      address: json['address'] ?? '',
      locationId: json['locationId'] ?? '',
      status: json['status'] ?? 'queue',
      workingOrderStatus: json['workingOrderStatus'] ?? 'pending',
      workingOrderNote: json['workingOrderNote'],
      installation: json['installation'] != null
          ? Installation.fromJson(json['installation'])
          : null,
      createdAt: json['createdAt'] ?? '',
      mapsUrl: json['mapsUrl'],
      subAreaId: json['sub_area_id'],
    );
  }
}

class Installation {
  final String technician;
  final String? companion;
  final String date;
  final String? finishDate;
  final List<String> photos;
  final String? coordinates;
  final String? secretId;
  final String? secretName;
  final String? ssidName;
  final String? ssidPassword;
  final String? signalLevel;
  final String? installationDate;
  final InstallationCost? cost;

  Installation({
    required this.technician,
    this.companion,
    required this.date,
    this.finishDate,
    this.photos = const [],
    this.coordinates,
    this.secretId,
    this.secretName,
    this.ssidName,
    this.ssidPassword,
    this.signalLevel,
    this.installationDate,
    this.cost,
  });

  factory Installation.fromJson(Map<String, dynamic> json) {
    return Installation(
      technician: json['technician'] ?? '',
      companion: json['companion'],
      date: json['date'] ?? '',
      finishDate: json['finishDate'],
      photos: (json['photos'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      coordinates: json['coordinates'],
      secretId: json['secretId'],
      secretName: json['secretName'],
      ssidName: json['ssidName'],
      ssidPassword: json['ssidPassword'],
      signalLevel: json['signalLevel'],
      installationDate: json['installationDate'],
      cost: json['cost'] != null ? InstallationCost.fromJson(json['cost']) : null,
    );
  }
}

class InstallationCost {
  final String name;
  final num price;

  InstallationCost({required this.name, required this.price});

  factory InstallationCost.fromJson(Map<String, dynamic> json) {
    return InstallationCost(
      name: json['name'] ?? '',
      price: json['price'] ?? 0,
    );
  }
}
