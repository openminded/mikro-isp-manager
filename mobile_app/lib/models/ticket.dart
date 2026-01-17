class Ticket {
  final String id;
  final String ticketNumber;
  final String customerName;
  final String customerPhone;
  final String? customerAddress;
  final String locationId; // Server Name
  final String damageTypeName;
  final String description;
  final String status; // open, in_progress, resolved, closed
  final String? technician;
  final String? solution;
  final String createdAt;
  final String? resolvedAt;

  Ticket({
    required this.id,
    required this.ticketNumber,
    required this.customerName,
    required this.customerPhone,
    this.customerAddress,
    required this.locationId,
    required this.damageTypeName,
    required this.description,
    required this.status,
    this.technician,
    this.solution,
    required this.createdAt,
    this.resolvedAt,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) {
    return Ticket(
      id: json['id'] ?? '',
      ticketNumber: json['ticketNumber'] ?? '',
      customerName: json['customerName'] ?? '',
      customerPhone: json['customerPhone'] ?? '',
      customerAddress: json['customerAddress'],
      locationId: json['locationId'] ?? '',
      damageTypeName: json['damageTypeName'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'open',
      technician: json['technician'],
      solution: json['solution'],
      createdAt: json['createdAt'] ?? '',
      resolvedAt: json['resolvedAt'],
    );
  }
}
