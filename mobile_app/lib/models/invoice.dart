import 'package:mobile_app/models/customer.dart';

class Invoice {
  final String id;
  final String customerId;
  final String serverId;
  final String period;
  final double amount;
  final String status;
  final String dueDate;
  final String createdAt;
  final Customer? customer;

  Invoice({
    required this.id,
    required this.customerId,
    required this.serverId,
    required this.period,
    required this.amount,
    required this.status,
    required this.dueDate,
    required this.createdAt,
    this.customer,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'],
      customerId: json['customer_id'],
      serverId: json['server_id'],
      period: json['period'],
      amount: double.tryParse(json['amount'].toString()) ?? 0.0,
      status: json['status'],
      dueDate: json['due_date'],
      createdAt: json['generated_at'] ?? json['createdAt'] ?? '',
      customer: json['Customer'] != null ? Customer.fromJson(json['Customer']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'customer_id': customerId,
      'server_id': serverId,
      'period': period,
      'amount': amount,
      'status': status,
      'due_date': dueDate,
      'generated_at': createdAt,
    };
  }
}
