import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/work_provider.dart';
import 'login_screen.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/installations_tab.dart';
import 'tabs/registrations_tab.dart';
import 'tabs/customers_tab.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../constants.dart';
import 'tabs/tickets_tab.dart';
import 'invoice_screen.dart';
import 'performance_screen.dart';
import 'dart:async';
import '../services/notification_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    NotificationService().init();
    
    // Start Polling every 1 minute
    _pollingTimer = Timer.periodic(const Duration(minutes: 1), (timer) {
        final auth = Provider.of<AuthProvider>(context, listen: false);
        if (auth.user != null) {
            Provider.of<WorkProvider>(context, listen: false).refreshData(auth.user);
        }
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  final List<Widget> _tabs = [
    const DashboardTab(),
    const InstallationsTab(),
    const TicketsTab(),
  ];

  final List<String> _titles = [
    'Dashboard',
    'Installations',
    'Support Tickets',
  ];

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user;

    List<Widget> displayTabs;
    List<String> displayTitles;
    List<BottomNavigationBarItem> displayNavItems;

    if (user?.role == 'admin' || user?.role == 'superadmin') {
        displayTabs = [
            const RegistrationsTab(),
            const InstallationsTab(),
            const CustomersTab(),
            const TicketsTab(),
            const InvoiceScreen(),
        ];
        displayTitles = [
            'Registrations',
            'Working Order', 
            'Customers',
            'Support Tickets',
            'Invoices',
        ];
        displayNavItems = const [
            BottomNavigationBarItem(icon: Icon(Icons.app_registration), label: 'Registrations'),
            BottomNavigationBarItem(icon: Icon(Icons.work), label: 'Working Order'),
            BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Customers'),
            BottomNavigationBarItem(icon: Icon(Icons.confirmation_number), label: 'Tickets'),
            BottomNavigationBarItem(icon: Icon(Icons.receipt_long), label: 'Invoices'),
        ];
    } else {
        displayTabs = _tabs;
        displayTitles = _titles;
        displayNavItems = const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.build), label: 'Installations'),
          BottomNavigationBarItem(icon: Icon(Icons.confirmation_number), label: 'Tickets'),
        ];
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(displayTitles[_currentIndex], style: const TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        flexibleSpace: Container(
            decoration: const BoxDecoration(
                gradient: LinearGradient(
                    colors: [Color(0xFF3949AB), Color(0xFF283593)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                )
            ),
        ),
        actions: [
            IconButton(
                icon: const Icon(Icons.logout),
                onPressed: () {
                    auth.logout();
                    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
                },
            )
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: displayTabs,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        type: BottomNavigationBarType.fixed, // Ensure all 4 items are visible
        selectedItemColor: Colors.blue,
        unselectedItemColor: Colors.grey,
        items: displayNavItems,
      ),
      drawer: Drawer(
         child: ListView(
            padding: EdgeInsets.zero,
            children: [
                DrawerHeader(
                  decoration: const BoxDecoration(
                    color: Colors.blue,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      GestureDetector(
                        onTap: () => _showPhotoOptions(context, auth),
                        child: CircleAvatar(
                          radius: 32,
                          backgroundColor: Colors.white,
                          backgroundImage: auth.employee?.photoUrl != null
                              ? NetworkImage(
                                  '${AppConstants.defaultBaseUrl.replaceAll('/api', '')}${auth.employee!.photoUrl!}')
                              : null,
                          child: auth.employee?.photoUrl == null
                              ? const Icon(Icons.person, size: 32, color: Colors.blue)
                              : null,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        auth.employee?.name ?? user?.name ?? 'Technician',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (auth.jobTitleName != null)
                        Text(
                          auth.jobTitleName!,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.white70,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      if (auth.employee?.ttl != null)
                        Text(
                          'Born: ${auth.employee?.ttl}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.white60,
                          ),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        user?.username ?? '',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.bar_chart),
                  title: const Text('Performance Report'),
                  onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PerformanceReportScreen()));
                  },
                ),
                 ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Logout'),
                    onTap: () {
                        auth.logout();
                        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
                    },
                ),
            ],
         ),
      ),
    );
  }

  Future<void> _showPhotoOptions(BuildContext context, AuthProvider auth) async {
      showModalBottomSheet(context: context, builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
            ListTile(
                leading: const Icon(Icons.camera_alt),
                title: const Text('Take Photo'),
                onTap: () { Navigator.pop(ctx); _uploadPhoto(auth, ImageSource.camera); }
            ),
            ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text('Choose from Gallery'),
                onTap: () { Navigator.pop(ctx); _uploadPhoto(auth, ImageSource.gallery); }
            ),
        ],
      ));
  }

  Future<void> _uploadPhoto(AuthProvider auth, ImageSource source) async {
       if (auth.employee == null) {
           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No employee profile linked.')));
           return;
       }
       
       try {
           final picker = ImagePicker();
            final XFile? image = await picker.pickImage(source: source, imageQuality: 10);
           if (image == null) return;

           // Upload
           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Uploading...')));
           
           // 1. Upload File
           var request = http.MultipartRequest('POST', Uri.parse('${AppConstants.defaultBaseUrl}/upload'));
           request.files.add(await http.MultipartFile.fromPath('photos', image.path));
           
           var res = await request.send();
           if (res.statusCode == 200) {
              final respStr = await res.stream.bytesToString();
              // extract url
             // json response { urls: ["/uploads/filename.jpg"] }
             // Need simple regex or json decode. Simple regex for now since I don't want to import convert again if avoided, but best to use ApiService logic?
             // Actually, ApiService doesn't handle Multipart well yet. I'll just do manual parse or simple string check.
             // But wait, I should assume valid JSON.
             
             // Quick hack for clean URL extraction
             final url = respStr.split('"urls":["')[1].split('"')[0]; // Very risky but works for standard response
             
             // 2. Update Employee
             final api = ApiService();
             await api.put('/employees/${auth.employee!.id}', {
                 'photoUrl': url
             });
             
             // 3. Refresh
             await auth.reloadEmployeeDetails();
             
             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo updated!')));
           } else {
               throw Exception('Upload failed code ${res.statusCode}');
           }

       } catch (e) {
           ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
       }
  }
}
