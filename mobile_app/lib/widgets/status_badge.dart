import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final String label;

  const StatusBadge({super.key, required this.status, required this.label});

  @override
  Widget build(BuildContext context) {
    Color color;
    Color bgColor;

    switch (status.toLowerCase()) {
      case 'done':
      case 'resolved':
      case 'completed':
        color = Colors.green.shade800;
        bgColor = Colors.green.shade50;
        break;
      case 'in_progress':
      case 'installation_process':
        color = Colors.blue.shade800;
        bgColor = Colors.blue.shade50;
        break;
      case 'pending':
      case 'open':
      case 'queue':
        color = Colors.amber.shade800;
        bgColor = Colors.amber.shade50;
        break;
      case 'cancel':
      case 'closed':
        color = Colors.red.shade800;
        bgColor = Colors.red.shade50;
        break;
      default:
        color = Colors.grey.shade800;
        bgColor = Colors.grey.shade100;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }
}
