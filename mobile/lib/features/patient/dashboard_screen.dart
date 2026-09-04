import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../core/network/network_providers.dart';
import '../../core/location/location_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/create_design_widgets.dart';
import '../../shared/widgets/offline_banner.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentNavIndex = 0;
  List<dynamic> _upcoming = [];
  List<dynamic> _providers = [];
  bool _loading = true;

  final List<Map<String, dynamic>> _serviceCategories = [
    {'id': 'cat-1', 'name': 'Doctor Visit', 'icon': Icons.medical_services_outlined, 'color': Color(0xFFE6F5F2), 'priceFrom': 800, 'count': 45},
    {'id': 'cat-2', 'name': 'Nursing Care', 'icon': Icons.favorite_border, 'color': Color(0xFFFEF3C7), 'priceFrom': 450, 'count': 62},
    {'id': 'cat-3', 'name': 'Physiotherapy', 'icon': Icons.directions_run, 'color': Color(0xFFE8F1FB), 'priceFrom': 600, 'count': 28},
    {'id': 'cat-4', 'name': 'Elderly Care', 'icon': Icons.elderly_outlined, 'color': Color(0xFFF5E6FF), 'priceFrom': 500, 'count': 34},
    {'id': 'cat-5', 'name': 'Lab Tests', 'icon': Icons.science_outlined, 'color': Color(0xFFFEE2E2), 'priceFrom': 350, 'count': 19},
    {'id': 'cat-6', 'name': 'Maternal Care', 'icon': Icons.child_care_outlined, 'color': Color(0xFFFCE7F3), 'priceFrom': 550, 'count': 22},
    {'id': 'cat-7', 'name': 'Medication', 'icon': Icons.medication_outlined, 'color': Color(0xFFECFDF5), 'priceFrom': 200, 'count': 40},
    {'id': 'cat-8', 'name': 'Post-Op Care', 'icon': Icons.healing_outlined, 'color': Color(0xFFE0E7FF), 'priceFrom': 700, 'count': 15},
  ];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments');
      final provRes = await client.dio.get('/providers');

      final dynamic aptData = response.data;
      final List allApts = aptData is List ? aptData : (aptData is Map && aptData['data'] is List ? aptData['data'] : []);

      final dynamic provData = provRes.data;
      final List allProvs = provData is List ? provData : (provData is Map && provData['data'] is List ? provData['data'] : []);

      if (mounted) {
        setState(() {
          _upcoming = allApts.where((a) => a['status'] != 'completed' && a['status'] != 'cancelled').toList();
          _providers = allProvs;
          _loading = false;
        });
      }
    } catch (e) {
      print('[PATIENT DASHBOARD] Error loading data: $e');
      if (mounted) {
        setState(() {
          _upcoming = [];
          _providers = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final locationState = ref.watch(locationProvider);
    final user = auth.user;
    final fullName = (user?['name']?.toString().isNotEmpty == true)
        ? user!['name'].toString()
        : (user?['email'] != null ? user!['email'].toString().split('@')[0] : 'Patient');
    final firstName = fullName.split(' ')[0];

    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ─── Header: Greeting & Notifications & Avatar ─────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$greeting,',
                              style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '$firstName 👋',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary, letterSpacing: -0.5),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            // Notifications bell
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.borderColor),
                              ),
                              child: Stack(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.notifications_outlined, size: 20, color: AppTheme.textSecondary),
                                    onPressed: () => context.push('/notifications'),
                                  ),
                                  Positioned(
                                    top: 10,
                                    right: 10,
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppTheme.errorColor,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => context.push('/profile-settings'),
                              borderRadius: BorderRadius.circular(20),
                              child: AvatarWidget(name: fullName, radius: 20),
                            ),
                          ],
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // ─── Auto-Detect GPS Location Banner ──────────────────────────────────
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.my_location, size: 16, color: AppTheme.primaryColor),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              locationState.location?.fullAddress ?? 'Bole, Addis Ababa (9.0054, 38.7845)',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                            ),
                          ),
                          InkWell(
                            onTap: () => ref.read(locationProvider.notifier).autoDetectCurrentLocation(),
                            child: Text(
                              locationState.isDetecting ? 'Detecting...' : 'Refresh GPS',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 14),

                    // ─── Emergency 907 Banner ─────────────────────────────────────────────
                    InkWell(
                      onTap: () => context.push('/emergency'),
                      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.errorLight,
                          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: const BoxDecoration(
                                color: AppTheme.errorColor,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.bolt, color: Colors.white, size: 20),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'For life-threatening emergencies',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF991B1B)),
                                  ),
                                  Text(
                                    'Call 907 (Ambulance) immediately',
                                    style: TextStyle(fontSize: 11, color: Color(0xFF991B1B)),
                                  ),
                                ],
                              ),
                            ),
                            const Text(
                              'Call 907',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.errorColor),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ─── Primary CTAs Card: Request Care Now & Schedule ───────────────────
                    CardWidget(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'How can we help you today?',
                            style: TextStyle(fontSize: 12, color: AppTheme.textMuted, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Get professional healthcare at home',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            onPressed: () => context.push('/patient/on-demand'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primaryColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.schedule, size: 18),
                                SizedBox(width: 8),
                                Text('Request Care Now', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: () => context.push('/services'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(44),
                              side: const BorderSide(color: AppTheme.primaryColor, width: 1.5),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.calendar_today_outlined, size: 16, color: AppTheme.primaryColor),
                                SizedBox(width: 8),
                                Text('Schedule for Later', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryColor)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ─── Active Service Card (Rendered only if real appointments exist) ───
                    if (_upcoming.isNotEmpty) ...[
                      InkWell(
                        onTap: () => context.push('/appointment/${_upcoming.first['id']}'),
                        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryColor,
                            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF4ADE80),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        (_upcoming.first['status'] ?? 'Scheduled').toString().toUpperCase(),
                                        style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${_upcoming.first['service'] ?? 'Consultation'} · ${_upcoming.first['date'] ?? 'Scheduled'}',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  if (_upcoming.first['provider'] != null && _upcoming.first['provider']['name'] != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        _upcoming.first['provider']['name'].toString(),
                                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                                      ),
                                    ),
                                ],
                              ),
                              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    const SizedBox(height: 20),

                    // ─── Services 4-Column Grid ───────────────────────────────────────────
                    SectionHeaderWidget(
                      title: 'Services',
                      actionLabel: 'See all',
                      onAction: () => context.push('/services'),
                    ),
                    const SizedBox(height: 10),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                        childAspectRatio: 0.85,
                      ),
                      itemCount: _serviceCategories.length,
                      itemBuilder: (context, index) {
                        final cat = _serviceCategories[index];
                        return InkWell(
                          onTap: () => context.push('/search-provider?specialty=${Uri.encodeComponent(cat['name'])}'),
                          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: cat['color'] as Color,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(cat['icon'] as IconData, size: 20, color: AppTheme.textPrimary),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  cat['name'] as String,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, height: 1.1),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 20),

                    // ─── Upcoming Appointment ─────────────────────────────────────────────
                    if (_upcoming.isNotEmpty) ...[
                      SectionHeaderWidget(
                        title: 'Upcoming',
                        actionLabel: 'All',
                        onAction: () => context.push('/appointments'),
                      ),
                      const SizedBox(height: 10),
                      AppointmentCardWidget(
                        appointment: _upcoming[0],
                        onTap: () => context.push('/appointment/${_upcoming[0]['id']}'),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // ─── Available Providers Carousel ─────────────────────────────────────
                    SectionHeaderWidget(
                      title: 'Available Providers',
                      actionLabel: 'See all',
                      onAction: () => context.push('/search-provider'),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 130,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _providers.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (context, index) {
                          final provider = _providers[index];
                          return SizedBox(
                            width: 220,
                            child: ProviderCardWidget(
                              provider: provider,
                              compact: true,
                              onTap: () => context.push('/provider/${provider['id']}'),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentNavIndex,
        onDestinationSelected: (index) {
          setState(() => _currentNavIndex = index);
          switch (index) {
            case 0:
              break;
            case 1:
              context.push('/services');
              break;
            case 2:
              context.push('/appointments');
              break;
            case 3:
              context.push('/chat/apt-101');
              break;
            case 4:
              context.push('/profile-settings');
              break;
          }
        },
        backgroundColor: Colors.white,
        elevation: 2,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: AppTheme.primaryColor), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.medical_services_outlined), selectedIcon: Icon(Icons.medical_services, color: AppTheme.primaryColor), label: 'Services'),
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today, color: AppTheme.primaryColor), label: 'Appointments'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble, color: AppTheme.primaryColor), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: AppTheme.primaryColor), label: 'Profile'),
        ],
      ),
    );
  }
}
