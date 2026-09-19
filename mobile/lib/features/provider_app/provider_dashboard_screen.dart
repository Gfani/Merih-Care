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
  String? _myProviderId;
  int _currentNavIndex = 0;
  bool _isOnline = true;
  double _todayEarnings = 0.0;
  int _completedVisits = 0;
  double? _rating;
  int _reviewCount = 0;
  List<dynamic> _incomingRequests = [];
  List<dynamic> _activeSchedule = [];
  bool _loading = true;
  Timer? _pollTimer;
  StreamSubscription? _serviceReqSub;
  StreamSubscription? _appointmentSub;

  @override
  void initState() {
    super.initState();
    ref.read(realtimeServiceProvider).joinProviders();
    _loadDashboardData();

    // Listen to live realtime dispatches from backend
    _serviceReqSub = ref.read(realtimeServiceProvider).serviceRequestsStream.listen((data) {
      if (!mounted || !_isOnline) return;

      // If this request is targeted at a specific provider, only respond if it's for us.
      // Open/on-demand requests have no providerId and should reach all providers.
      final targetProviderId = data['providerId'];
      if (targetProviderId != null && targetProviderId.toString().isNotEmpty) {
        // Resolve current provider's ID from auth state and loaded profile
        final authUser = ref.read(authProvider).user;
        final myUserId = authUser?['id']?.toString() ?? '';
        final myProvAuthId = authUser?['provider']?['id']?.toString() ??
            authUser?['providerId']?.toString() ??
            authUser?['provider_id']?.toString() ??
            '';
        final matches = targetProviderId.toString() == myUserId ||
            (myProvAuthId.isNotEmpty && targetProviderId.toString() == myProvAuthId) ||
            (_myProviderId != null && targetProviderId.toString() == _myProviderId);
        if (!matches) return; // Not for this provider — ignore entirely
      }

      _loadDashboardData();
      final serviceName = data['service'] ?? data['serviceType'] ?? 'Care Service';
      final patientName = data['patientName'] ?? 'Patient';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('🔔 New Patient Care Request: $serviceName for $patientName'),
          backgroundColor: AppTheme.primaryColor,
          duration: const Duration(seconds: 4),
        ),
      );
    });

    _appointmentSub = ref.read(realtimeServiceProvider).appointmentUpdatesStream.listen((_) {
      if (mounted && _isOnline) {
        _loadDashboardData();
      }
    });

    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _isOnline) {
        _loadDashboardData();
      }
    });
  }

  @override
  void dispose() {
    _serviceReqSub?.cancel();
    _appointmentSub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadDashboardData() async {
    try {
      final client = ref.read(apiClientProvider);
      final now = DateTime.now();
      final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      final response = await client.dio.get('/appointments');
      final dynamic raw = response.data;
      final List all = (raw is List)
          ? raw
          : (raw is Map<String, dynamic> && raw['data'] is List ? raw['data'] as List : []);

      // Fetch actual provider rating and review count from backend
      double ratingVal = 0.0;
      int reviews = 0;
      try {
        final provRes = await client.dio.get('/providers/me');
        final dynamic pData = provRes.data is Map<String, dynamic> ? provRes.data : {};
        _myProviderId = pData['id']?.toString() ?? pData['userId']?.toString();
        if (pData['rating'] != null) {
          ratingVal = (pData['rating'] as num).toDouble();
        }
        if (pData['reviewCount'] != null) {
          reviews = (pData['reviewCount'] as num).toInt();
        }
      } catch (_) {
        final authUser = ref.read(authProvider).user;
        if (authUser != null && authUser['rating'] != null) {
          ratingVal = (authUser['rating'] as num).toDouble();
        }
        if (authUser != null && authUser['reviewCount'] != null) {
          reviews = (authUser['reviewCount'] as num).toInt();
        }
      }

      // Compute actual completed visits and today's earnings
      final completedAppts = all.where((a) => a['status'] == 'completed').toList();
      final completedToday = completedAppts.where((a) {
        final date = (a['date'] ?? '').toString();
        return date.startsWith(todayStr);
      }).toList();

      double earningsToday = 0.0;
      for (final a in completedToday) {
        final amt = a['amount'] ?? a['price'] ?? 0;
        if (amt is num) earningsToday += amt.toDouble();
      }

      if (mounted) {
        setState(() {
          _todayEarnings = earningsToday;
          _completedVisits = completedAppts.length;
          _rating = ratingVal;
          _reviewCount = reviews;
          _incomingRequests = all.where((a) => a['status'] == 'requested' || a['status'] == 'searching' || a['status'] == 'pending').toList();
          _activeSchedule = all.where((a) => a['status'] == 'accepted' || a['status'] == 'scheduled' || a['status'] == 'on_the_way' || a['status'] == 'arrived' || a['status'] == 'in_progress').toList();
          _loading = false;
        });
      }
    } catch (e) {
      print('[PROVIDER] loadDashboardData error: $e');
    }
  }

  Map<String, dynamic>? get _activeInFlightTask {
    for (final a in _activeSchedule) {
      final status = a['status']?.toString();
      if (status == 'accepted' || status == 'on_the_way' || status == 'arrived' || status == 'in_progress') {
        return a as Map<String, dynamic>;
      }
    }
    return null;
  }

  Future<void> _acceptIncomingRequest(dynamic req) async {
    try {
      final client = ref.read(apiClientProvider);
      final aptId = req['id']?.toString() ?? req['appointmentId']?.toString() ?? 'apt-1';
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
      context.push('/provider/active-request', extra: req);
    } catch (_) {
      if (!mounted) return;
      context.push('/provider/active-request', extra: req);
    }
  }

  Future<void> _declineIncomingRequest(dynamic req) async {
    try {
      final client = ref.read(apiClientProvider);
      final aptId = req['id']?.toString() ?? req['appointmentId']?.toString() ?? 'apt-1';
      await client.dio.put('/appointments/$aptId/status', data: {
        'status': 'cancelled',
        'visitNotes': 'Provider declined incoming request',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Care request declined.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      _loadDashboardData();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to decline request: $e')),
      );
    }
  }

  Future<void> _toggleOnline() async {
    final next = !_isOnline;
    setState(() => _isOnline = next);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.put('/providers/me', data: {'available': next});
    } catch (e) {
      print('[PROVIDER] Failed to sync availability: $e');
    }
    if (!mounted) return;
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

                    // ─── Active Ongoing Patient Visit (Uber-Style Task Banner) ────────────
                    if (_activeInFlightTask != null) ...[
                      Builder(
                        builder: (context) {
                          final task = _activeInFlightTask!;
                          final status = task['status']?.toString() ?? 'accepted';
                          final patientName = task['patientName'] ?? (task['patient'] is Map ? task['patient']['name'] : null) ?? 'Patient';
                          final service = task['service'] ?? (task['serviceRelation'] is Map ? task['serviceRelation']['name'] : null) ?? 'Care Visit';
                          final location = task['location'] ?? task['address'] ?? 'Patient Location';

                          String statusTitle;
                          String statusSubtitle;
                          IconData statusIcon;

                          if (status == 'accepted') {
                            statusTitle = '🚑 Patient Visit Accepted';
                            statusSubtitle = '$patientName • Ready to start transit to $location';
                            statusIcon = Icons.navigation_outlined;
                          } else if (status == 'on_the_way') {
                            statusTitle = '🚗 En Route to Patient';
                            statusSubtitle = 'Navigating to $location';
                            statusIcon = Icons.directions_car;
                          } else if (status == 'arrived') {
                            statusTitle = '🏡 Arrived at Patient Location';
                            statusSubtitle = 'Outside $patientName\'s home • Ready to start care visit';
                            statusIcon = Icons.home_work;
                          } else if (status == 'in_progress') {
                            statusTitle = '🩺 Clinical Visit in Progress';
                            statusSubtitle = 'Providing $service for $patientName';
                            statusIcon = Icons.medical_services;
                          } else {
                            statusTitle = 'Active Patient Task';
                            statusSubtitle = '$patientName • $service';
                            statusIcon = Icons.medical_services_outlined;
                          }

                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF0F766E), Color(0xFF115E59)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0F766E).withValues(alpha: 0.25),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.15),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(statusIcon, color: Colors.white, size: 20),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            statusTitle,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            statusSubtitle,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.white.withValues(alpha: 0.85),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    onPressed: () {
                                      context.push('/provider/active-request', extra: task);
                                    },
                                    icon: const Icon(Icons.play_arrow_rounded, size: 18),
                                    label: const Text('Resume Active Visit', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.white,
                                      foregroundColor: const Color(0xFF0F766E),
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                      elevation: 0,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],

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
                              _buildStat(
                                _rating == null || _rating == 0.0 ? '0.0 ★' : '${_rating!.toStringAsFixed(1)} ★',
                                _reviewCount == 0 ? 'No ratings' : 'Rating ($_reviewCount)',
                                AppTheme.warningColor,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),

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
                                  Text('Gross Fee: ETB ${req['price'] ?? req['amount'] ?? 800}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                                  Row(
                                    children: [
                                      OutlinedButton(
                                        onPressed: () => _declineIncomingRequest(req),
                                        style: OutlinedButton.styleFrom(
                                          minimumSize: const Size(70, 36),
                                          padding: const EdgeInsets.symmetric(horizontal: 10),
                                          side: const BorderSide(color: Color(0xFFEF4444)),
                                          foregroundColor: const Color(0xFFDC2626),
                                        ),
                                        child: const Text('Decline', style: TextStyle(fontSize: 12)),
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton(
                                        onPressed: () => _acceptIncomingRequest(req),
                                        style: ElevatedButton.styleFrom(
                                          minimumSize: const Size(70, 36),
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                        ),
                                        child: const Text('Accept', style: TextStyle(fontSize: 12)),
                                      ),
                                    ],
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
