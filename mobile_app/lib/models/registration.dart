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
    );
  }
}

class Installation {
  final String technician;
  final String date;
  final String? finishDate;

  Installation({
    required this.technician,
    required this.date,
    this.finishDate,
  });

  factory Installation.fromJson(Map<String, dynamic> json) {
    return Installation(
      technician: json['technician'] ?? '',
      date: json['date'] ?? '',
      finishDate: json['finishDate'],
    );
  }
}
