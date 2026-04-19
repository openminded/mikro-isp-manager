import 'package:flutter/material.dart';

class SearchableListDialog extends StatefulWidget {
  final String title;
  final List<Map<String, String?>> items; // [{'id': '...', 'label': '...', 'sub': '...'}]

  const SearchableListDialog({required this.title, required this.items});

  @override
  State<SearchableListDialog> createState() => _SearchableListDialogState();
}

class _SearchableListDialogState extends State<SearchableListDialog> {
  String _query = '';
  List<Map<String, String?>> _filteredItems = [];

  @override
  void initState() {
    super.initState();
    _filteredItems = widget.items;
  }

  void _filter(String query) {
    setState(() {
      _query = query;
      _filteredItems = widget.items.where((item) {
        final label = item['label']?.toLowerCase() ?? '';
        final sub = item['sub']?.toLowerCase() ?? '';
        final q = query.toLowerCase();
        return label.contains(q) || sub.contains(q);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
       child: Container(
           padding: const EdgeInsets.all(16),
           constraints: const BoxConstraints(maxHeight: 500),
           child: Column(
               mainAxisSize: MainAxisSize.min,
               children: [
                   Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                   const SizedBox(height: 12),
                   TextField(
                       decoration: const InputDecoration(
                           labelText: 'Search',
                           prefixIcon: Icon(Icons.search),
                           border: OutlineInputBorder()
                       ),
                       onChanged: _filter,
                   ),
                   const SizedBox(height: 12),
                   Expanded(
                       child: _filteredItems.isEmpty 
                           ? const Center(child: Text('No results found.', style: TextStyle(color: Colors.grey)))
                           : ListView.separated(
                               itemCount: _filteredItems.length,
                               separatorBuilder: (_, __) => const Divider(),
                               itemBuilder: (ctx, idx) {
                                   final item = _filteredItems[idx];
                                   return ListTile(
                                       title: Text(item['label'] ?? 'Unknown'),
                                       subtitle: item['sub'] != null ? Text(item['sub']!) : null,
                                       onTap: () => Navigator.pop(context, item['id']),
                                   );
                               },
                           )
                   ),
                   const SizedBox(height: 8),
                   TextButton(
                       onPressed: () => Navigator.pop(context),
                       child: const Text('Cancel')
                   )
               ],
           ),
       )
    );
  }
}
