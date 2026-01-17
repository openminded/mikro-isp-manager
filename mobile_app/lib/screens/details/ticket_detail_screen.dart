import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/work_item.dart';
import '../../providers/work_provider.dart';
import '../../widgets/status_badge.dart';
import '../../models/ticket.dart';

class TicketDetailScreen extends StatefulWidget {
  final WorkItem item;

  const TicketDetailScreen({super.key, required this.item});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  final _solutionController = TextEditingController();
  bool _isLoading = false;

  void _handleResolve() async {
    if (_solutionController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter solution details')));
        return;
    }
    setState(() => _isLoading = true);
    try {
        await Provider.of<WorkProvider>(context, listen: false).resolveTicket(widget.item.id, _solutionController.text);
        if(!mounted) return;
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket Resolved!')));
    } catch(e) {
        if(!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
        if(mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ticket = widget.item.originalObject as Ticket;

    return Scaffold(
      appBar: AppBar(title: const Text('Ticket Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
             Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            StatusBadge(status: widget.item.status, label: widget.item.rawStatus),
                            Text('#${ticket.ticketNumber}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        ]),
                        const SizedBox(height: 12),
                        Text(widget.item.customerName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                         const SizedBox(height: 8),
                         Row(children: [const Icon(Icons.warning, color: Colors.orange, size: 16), const SizedBox(width: 8), Text(ticket.damageTypeName, style: const TextStyle(fontWeight: FontWeight.bold))]),
                         const SizedBox(height: 8),
                         Text(ticket.description, style: const TextStyle(color: Colors.grey)),
                    ],
                ),
             ),
             
             if (widget.item.status != 'done') ...[
                 const SizedBox(height: 24),
                 const Text('Resolution', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                 const SizedBox(height: 12),
                 TextField(
                    controller: _solutionController,
                    decoration: const InputDecoration(
                        labelText: 'Solution / Repair Notes',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                    ),
                    maxLines: 5,
                 ),
                 const SizedBox(height: 16),
                 SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleResolve,
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                        child: _isLoading ? const CircularProgressIndicator(color: Colors.white) : const Text('Resolve Ticket'),
                    ),
                 )
             ]
          ],
        ),
      ),
    );
  }
}
