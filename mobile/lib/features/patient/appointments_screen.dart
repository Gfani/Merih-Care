import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/error_state.dart';

class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _appointments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAppointments();
  }

  Future<void> _loadAppointments() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments/patient');
      if (mounted) {
        setState(() {
          _appointments = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _appointments = [
            {
              'id': 'appt-101',
              'provider': {'name': 'Dr. Meron Alemu', 'specialty': 'General Care'},
              'date': '2026-08-30',
              'time': '10:00 AM',
              'status': 'scheduled',
            },
            {
              'id': 'appt-102',
              'provider': {'name': 'Nurse Bereket Solomon', 'specialty': 'Nursing Visit'},
              'date': '2026-08-25',
              'time': '02:00 PM',
              'status': 'completed',
            }
          ];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = _appointments.where((a) => a['status'] != 'completed' && a['status'] != 'cancelled').toList();
    final history = _appointments.where((a) => a['status'] == 'completed' || a['status'] == 'cancelled').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visits & Bookings'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: theme.primaryColor,
          labelColor: theme.primaryColor,
          unselectedLabelColor: const Color(0xFF8A9AAA),
          tabs: const [
            Tab(text: 'Active Care'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading appointments')
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildList(active, theme),
                      _buildList(history, theme),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<dynamic> list, ThemeData theme) {
    if (list.isEmpty) {
      return const ErrorStateWidget(
        message: 'No appointments found.',
        icon: Icons.calendar_today_outlined,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: list.length,
      itemBuilder: (context, idx) {
        final appt = list[idx];
        final provider = appt['provider'] ?? {};
        final status = (appt['status'] ?? 'PENDING').toString().toUpperCase();

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: theme.primaryColor.withOpacity(0.1),
              child: Icon(Icons.person, color: theme.primaryColor),
            ),
            title: Text(provider['name'] ?? 'Provider Name', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(provider['specialty'] ?? 'Healthcare Specialist'),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.calendar_month, size: 12, color: Color(0xFF8A9AAA)),
                    const SizedBox(width: 4),
                    Text('${appt['date']} @ ${appt['time']}', style: const TextStyle(fontSize: 11, color: Color(0xFF8A9AAA))),
                  ],
                ),
              ],
            ),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: status == 'COMPLETED' ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                status,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: status == 'COMPLETED' ? const Color(0xFF166534) : const Color(0xFF92400E),
                ),
              ),
            ),
            onTap: () => context.push('/appointment/${appt['id']}'),
          ),
        );
      },
    );
  }
}
