import 'package:flutter/material.dart';
import '../models/work_item.dart';
import 'status_badge.dart';

class WorkItemCard extends StatelessWidget {
  final WorkItem item;
  final VoidCallback? onTap;
  final VoidCallback? onAction;
  final String actionLabel;

  const WorkItemCard({
    super.key,
    required this.item,
    this.onTap,
    this.onAction,
    this.actionLabel = 'View',
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  StatusBadge(status: item.status, label: item.rawStatus),
                  Text(
                    item.type == WorkItemType.installation ? 'Installation' : 'Ticket',
                    style: TextStyle(
                      fontSize: 12,
                      color: item.type == WorkItemType.installation ? Colors.blue : Colors.purple,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                item.customerName,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_on, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.address,
                      style: const TextStyle(fontSize: 14, color: Colors.grey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              if (item.server.isNotEmpty)
              Row(
                children: [
                   const Icon(Icons.router, size: 14, color: Colors.grey),
                   const SizedBox(width: 4),
                   Text(
                      item.server,
                      style: const TextStyle(fontSize: 14, color: Colors.grey),
                   ),
              ],),
              const SizedBox(height: 12),
              if (item.note != null && item.note!.isNotEmpty)
                 Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade100)
                    ),
                    child: Text(
                        '"${item.note}"',
                        style: TextStyle(fontStyle: FontStyle.italic, color: Colors.amber.shade900, fontSize: 13),
                    ),
                 ),
            ],
          ),
        ),
      ),
    );
  }
}
