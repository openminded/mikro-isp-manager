import 'registration.dart';
import 'ticket.dart';

enum WorkItemType { installation, ticket }

class WorkItem {
  final String id;
  final WorkItemType type;
  final String customerName;
  final String phoneNumber;
  final String address;
  final String server;
  final String technician;
  final String date;
  final String status; // pending, in_progress, done, cancel
  final String rawStatus;
  final String? note;
  final dynamic originalObject; // Registration or Ticket

  WorkItem({
    required this.id,
    required this.type,
    required this.customerName,
    required this.phoneNumber,
    required this.address,
    required this.server,
    required this.technician,
    required this.date,
    required this.status,
    required this.rawStatus,
    this.note,
    this.originalObject,
  });
}
