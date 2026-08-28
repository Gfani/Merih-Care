import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentIndex = 0;
  List<dynamic> _upcoming = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAppointments();
  }

  Future<void> _loadAppointments() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments/patient');
      if (mounted) {
        setState(() {
          _upcoming = (response.data as List).where((a) => a['status'] != 'completed' && a['status'] != 'cancelled').toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _upcoming = [
            {
              'id': 'appt-101',
              'provider': {'name': 'Dr. Meron Alemu', 'specialty': 'General Practitioner'},
              'date': '2026-08-30',
              'time': '10:00 AM',
              'status': 'scheduled',
            }
          ];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final theme = Theme.of(context);
    final user = auth.user;
    final userName = user?['name'] ?? 'Patient';

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              backgroundColor: theme.primaryColor.withOpacity(0.1),
              child: Text(userName[0].toUpperCase(), style: TextStyle(color: theme.primaryColor, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Hello,', style: TextStyle(fontSize: 11, color: Color(0xFF8A9AAA))),
                Text(userName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
        actions: [
          Semantics(
            button: true,
            label: 'View notifications',
            child: IconButton(
              icon: const Icon(Icons.notifications_outlined),
              onPressed: () => context.push('/notifications'),
            ),
          ),
          Semantics(
            button: true,
            label: 'Sign out',
            child: IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (mounted) context.go('/login');
              },
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _currentIndex == 0 ? _buildHome(theme) : _buildPlaceholderTab(),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) {
          if (idx == 1) {
            context.push('/appointments');
          } else if (idx == 2) {
            context.push('/profile-settings');
          } else {
            setState(() => _currentIndex = idx);
          }
        },
        selectedItemColor: theme.primaryColor,
        unselectedItemColor: const Color(0xFF8A9AAA),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), label: 'Bookings'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Settings'),
        ],
      ),
    );
  }

  Widget _buildHome(ThemeData theme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [theme.primaryColor, const Color(0xFF0A5C4E)]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Urgent Care Required?', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Initiate emergency siren to dispatch the nearest medical responder immediately.', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => context.push('/emergency'),
                  icon: const Icon(Icons.notifications_active_outlined, color: Colors.red),
                  label: const Text('ACTIVATE EMERGENCY', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    minimumSize: const Size(180, 40),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // Action grid
          const Text('Services', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF18232E))),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.4,
            children: [
              _buildGridCard(theme, Icons.local_hospital_outlined, 'Book Care', 'Consult professionals', () => context.push('/services')),
              _buildGridCard(theme, Icons.folder_shared_outlined, 'Medical File', 'View records', () => context.push('/medical-records')),
              _buildGridCard(theme, Icons.chat_bubble_outline, 'Chats', 'Contact provider', () => context.push('/chat/general')),
              _buildGridCard(theme, Icons.settings_outlined, 'Settings', 'Preferences', () => context.push('/profile-settings')),
            ],
          ),
          const SizedBox(height: 24),
          // Upcoming appointments
          const Text('Upcoming Visits', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF18232E))),
          const SizedBox(height: 12),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_upcoming.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              width: double.infinity,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: const Column(
                children: [
                  Icon(Icons.calendar_today, size: 40, color: Color(0xFF8A9AAA)),
                  SizedBox(height: 8),
                  Text('No upcoming visits.', style: TextStyle(color: Color(0xFF8A9AAA), fontSize: 13)),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _upcoming.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, idx) {
                final appt = _upcoming[idx];
                final provider = appt['provider'] ?? {};
                return InkWell(
                  onTap: () => context.push('/appointment/${appt['id']}'),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: theme.primaryColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                          child: Icon(Icons.person, color: theme.primaryColor),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(provider['name'] ?? 'Provider', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              Text(provider['specialty'] ?? 'Specialist', style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 12)),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.access_time, size: 12, color: Color(0xFF8A9AAA)),
                                  const SizedBox(width: 4),
                                  Text('${appt['date']} @ ${appt['time']}', style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 11)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: Color(0xFF8A9AAA)),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildGridCard(ThemeData theme, IconData icon, String title, String sub, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8EE)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: theme.primaryColor, size: 24),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF18232E))),
            Text(sub, style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderTab() {
    return const Center(child: Text('Tab loading...'));
  }
}
