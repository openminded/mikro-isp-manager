import 'package:flutter/material.dart';
import '../models/work_item.dart';
import 'status_badge.dart';
import 'package:url_launcher/url_launcher.dart';

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
    Color statusColor;
    if (item.status == 'queue') statusColor = Colors.orange;
    else if (item.status == 'done') statusColor = Colors.green;
    else if (item.status == 'cancel') statusColor = Colors.red;
    else statusColor = Colors.blue;

    return Card(
      elevation: 3,
      shadowColor: Colors.black12,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  stops: const [0.02, 0.02],
                  colors: [statusColor, Colors.white]
              )
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                        child: Text(item.rawStatus.toUpperCase(), style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 10))
                    ),
                    Text(
                      item.type == WorkItemType.installation ? 'INSTALLATION' : 'TICKET',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade400,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  item.customerName,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
                const SizedBox(height: 6),
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
                if (item.mapsUrl != null && item.mapsUrl!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: InkWell(
                      onTap: () async {
                        var urlString = item.mapsUrl!;
                        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
                          urlString = 'https://$urlString';
                        }
                        final uri = Uri.parse(urlString);
                        try {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        } catch (e) {
                          debugPrint('Could not launch maps: $e');
                        }
                      },
                      child: Row(
                        children: [
                           Container(
                               padding: const EdgeInsets.all(4),
                               decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(4)),
                               child: const Icon(Icons.map, size: 14, color: Colors.blue),
                           ),
                           const SizedBox(width: 8),
                           const Text(
                             'Open Maps',
                             style: TextStyle(fontSize: 14, color: Colors.blue, fontWeight: FontWeight.w600),
                           ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
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
                      padding: const EdgeInsets.all(12),
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
      ),
    );
  }
}
