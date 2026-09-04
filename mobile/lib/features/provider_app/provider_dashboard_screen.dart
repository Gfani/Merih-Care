import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../auth/auth_provider.dart';
import '../../core/location/location_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/create_design_widgets.dart';
import '../../shared/widgets/offline_banner.dart';

class ProviderDashboardScreen extends ConsumerStatefulWidget {
  const ProviderDashboardScreen({super.key});

  @override
  ConsumerState<ProviderDashboardScreen> createState() => _ProviderDashboardScreenState();
}

class _ProviderDashboardScreenState extends ConsumerState<ProviderDashboardScreen> {
  int _currentNavIndex = 0;
  bool _isOnline = true;
  double _todayEarnings = 2500.0;
  int _completedVisits = 3;
  List<dynamic> _incomingRequests = [];
  List<dynamic> _activeSchedule = [];
  bool _loading = true;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _isOnline) {
        _loadDashboardData();
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadDashboardData() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments');
      final dynamic raw = response.data;
      final List all = (raw is List)
          ? raw
          : (raw is Map<String, dynamic> && raw['data'] is List ? raw['data'] as List : []);

      if (mounted) {
        setState(() {
          _incomingRequests = all.where((a) => a['status'] == 'requested' || a['status'] == 'searching' || a['status'] == 'pending').toList();
          _activeSchedule = all.where((a) => a['status'] == 'accepted' || a['status'] == 'scheduled' || a['status'] == 'in_progress').toList();
          _loading = false;
        });
      }
    } catch (e) {
      print('[PROVIDER] loadDashboardData error: $e');
    }
  }

  Future<void> _acceptIncomingRequest(dynamic req) async {
    try {
      final client = ref.read(apiClientProvider);
      final aptId = req['id']?.toString() ?? 'apt-1';
      await client.dio.put('/appointments/$aptId/status', data: {
        'status': 'accepted',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Care request accepted! Proceeding to patient location.'),
          backgroundColor: AppTheme.primaryColor,
        ),
      );
      _loadDashboardData();
      context.push('/provider/active-request');
    } catch (_) {
      if (!mounted) return;
      context.push('/provider/active-request');
    }
  }

  void _toggleOnline() {
    setState(() => _isOnline = !_isOnline);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(_isOnline ? 'You are now Online and receiving patient dispatches.' : 'You are now Offline.'),
        backgroundColor: _isOnline ? AppTheme.primaryColor : AppTheme.textSecondary,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final locationState = ref.watch(locationProvider);
    final user = auth.user;
    final rawName = user?['name']?.toString().trim();
    final fullName = (rawName != null && rawName.isNotEmpty)
        ? rawName
        : (user?['email'] != null ? user!['email'].toString().split('@')[0] : 'Healthcare Provider');
    final firstName = fullName.split(' ')[0];

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: _loading
                  ? const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                    // ─── Header: Greeting & Avatar ────────────────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Provider Portal,', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            const SizedBox(height: 2),
                            Text(
                              '$firstName 👋',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            ),
                          ],
                        ),
                        InkWell(
                          onTap: () => context.push('/profile-settings'),
                          borderRadius: BorderRadius.circular(22),
                          child: AvatarWidget(name: fullName, radius: 22, verified: true),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // ─── Duty Status Online / Offline Toggle Card ─────────────────────────
                    InkWell(
                      onTap: _toggleOnline,
                      borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _isOnline ? AppTheme.primaryColor : Colors.white,
                          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                          border: Border.all(color: _isOnline ? AppTheme.primaryDark : AppTheme.borderColor),
                          boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 8)],
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: _isOnline ? Colors.white.withOpacity(0.2) : AppTheme.surfaceColor,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                _isOnline ? Icons.power_settings_new : Icons.power_off,
                                color: _isOnline ? Colors.white : AppTheme.textMuted,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _isOnline ? 'You are Online' : 'You are Offline',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                      color: _isOnline ? Colors.white : AppTheme.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _isOnline ? 'Ready to receive on-demand dispatches' : 'Tap to switch online and accept patients',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: _isOnline ? Colors.white.withOpacity(0.8) : AppTheme.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _isOnline ? const Color(0xFF4ADE80) : const Color(0xFF9CA3AF),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 14),

                    // ─── Base Location Card ───────────────────────────────────────────────
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
                              'Base: ${locationState.location?.fullAddress ?? "Bole Road, Addis Ababa"}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                            ),
                          ),
                          InkWell(
                            onTap: () => ref.read(locationProvider.notifier).autoDetectCurrentLocation(),
                            child: Text(
                              locationState.isDetecting ? 'Locating...' : 'Update GPS',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ─── Today's Earnings & Stats ─────────────────────────────────────────
                    CardWidget(
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Today\'s Performance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              InkWell(
                                onTap: () => context.push('/provider/earnings'),
                                child: const Text('View Earnings', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                              ),
                            ],
                          ),
                          const Divider(height: 20, color: AppTheme.borderColor),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _buildStat('ETB ${_todayEarnings.toInt()}', 'Earned Today', AppTheme.primaryColor),
                              _buildStat('$_completedVisits', 'Visits Done', AppTheme.secondaryColor),
                              _buildStat('4.9 ★', 'Rating (42)', AppTheme.warningColor),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ─── Simulate On-Demand Dispatch Button ───────────────────────────────
                    ElevatedButton.icon(
                      onPressed: () => context.push('/provider/active-request'),
                      icon: const Icon(Icons.flash_on, size: 18),
                      label: const Text('Simulate On-Demand Request Flow'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.secondaryColor,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // ─── Incoming Requests List ───────────────────────────────────────────
                    SectionHeaderWidget(
                      title: 'Incoming Requests (${_incomingRequests.length})',
                    ),
                    const SizedBox(height: 10),
                    if (_incomingRequests.isEmpty)
                      const CardWidget(
                        padding: EdgeInsets.all(24),
                        child: Center(
                          child: Text('No active dispatches waiting. Keep status Online.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        ),
                      )
                    else
                      ..._incomingRequests.map((req) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: CardWidget(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      AvatarWidget(name: req['patientName'] ?? 'Patient', radius: 16),
                                      const SizedBox(width: 8),
                                      Text(req['patientName'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    ],
                                  ),
                                  const StatusBadgeWidget(status: 'searching'),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(req['service'] ?? 'Home Visit', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 2),
                              Text(req['location'] ?? 'Addis Ababa', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Gross Fee: ETB ${req['price']}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                                  ElevatedButton(
                                    onPressed: () => _acceptIncomingRequest(req),
                                    style: ElevatedButton.styleFrom(
                                      minimumSize: const Size(90, 36),
                                      padding: const EdgeInsets.symmetric(horizontal: 14),
                                    ),
                                    child: const Text('Accept', style: TextStyle(fontSize: 12)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      )),

                    const SizedBox(height: 20),

                    // ─── Today's Schedule ─────────────────────────────────────────────────
                    SectionHeaderWidget(
                      title: 'Today\'s Schedule',
                      actionLabel: 'Calendar',
                      onAction: () => context.push('/provider/availability'),
                    ),
                    const SizedBox(height: 10),
                    if (_activeSchedule.isNotEmpty)
                      AppointmentCardWidget(
                        appointment: _activeSchedule[0],
                        onTap: () => context.push('/provider/appointment/${_activeSchedule[0]['id']}'),
                      ),
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
              context.push('/provider/availability');
              break;
            case 2:
              context.push('/provider/earnings');
              break;
            case 3:
              context.push('/chat/apt-101');
              break;
            case 4:
              context.push('/provider/credentials');
              break;
          }
        },
        backgroundColor: Colors.white,
        elevation: 2,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard, color: AppTheme.primaryColor), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.schedule_outlined), selectedIcon: Icon(Icons.schedule, color: AppTheme.primaryColor), label: 'Schedule'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet, color: AppTheme.primaryColor), label: 'Earnings'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble, color: AppTheme.primaryColor), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.verified_user_outlined), selectedIcon: Icon(Icons.verified_user, color: AppTheme.primaryColor), label: 'Credentials'),
        ],
      ),
    );
  }

  Widget _buildStat(String value, String label, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
      ],
    );
  }
}
