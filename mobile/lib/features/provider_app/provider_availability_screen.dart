import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/app_theme.dart';
import '../auth/auth_provider.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/offline_banner.dart';

class ProviderAvailabilityScreen extends ConsumerStatefulWidget {
  const ProviderAvailabilityScreen({super.key});

  @override
  ConsumerState<ProviderAvailabilityScreen> createState() => _ProviderAvailabilityScreenState();
}

class _ProviderAvailabilityScreenState extends ConsumerState<ProviderAvailabilityScreen> {
  List<dynamic> _timeSlots = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAvailability();
  }

  Future<void> _loadAvailability() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final now = DateTime.now();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    try {
      final auth = ref.read(authProvider);
      final providerId = auth.user?['id'] ?? 'p-1';
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/availability/$providerId?date=$todayStr');
      if (mounted) {
        setState(() {
          _timeSlots = response.data['timeSlots'] ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _timeSlots = [
            {'id': 'slot-0900', 'date': todayStr, 'time': '09:00 - 10:00', 'available': true},
            {'id': 'slot-1000', 'date': todayStr, 'time': '10:00 - 11:00', 'available': true},
            {'id': 'slot-1100', 'date': todayStr, 'time': '11:00 - 12:00', 'available': true},
            {'id': 'slot-1400', 'date': todayStr, 'time': '14:00 - 15:00', 'available': true},
            {'id': 'slot-1500', 'date': todayStr, 'time': '15:00 - 16:00', 'available': true},
            {'id': 'slot-1600', 'date': todayStr, 'time': '16:00 - 17:00', 'available': true},
          ];
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleSlot(int index) async {
    final slot = _timeSlots[index];
    final updatedVal = !slot['available'];
    final now = DateTime.now();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    setState(() {
      _timeSlots[index]['available'] = updatedVal;
    });

    try {
      final client = ref.read(apiClientProvider);
      final auth = ref.read(authProvider);
      final providerId = auth.user?['id'] ?? 'p-1';
      await client.dio.put('/availability/$providerId/slots', data: {
        'slotId': slot['id'],
        'time': slot['time'],
        'date': slot['date'] ?? todayStr,
        'available': updatedVal,
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _timeSlots[index]['available'] = !updatedVal;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update slot availability on server.')),
        );
      }
    }
  }

  Future<void> _toggleAll(bool enable) async {
    setState(() {
      for (final slot in _timeSlots) {
        slot['available'] = enable;
      }
    });

    final now = DateTime.now();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
    final client = ref.read(apiClientProvider);
    final auth = ref.read(authProvider);
    final providerId = auth.user?['id'] ?? 'p-1';
    for (final slot in _timeSlots) {
      try {
        await client.dio.put('/availability/$providerId/slots', data: {
          'slotId': slot['id'],
          'time': slot['time'],
          'date': slot['date'] ?? todayStr,
          'available': enable,
        });
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final activeCount = _timeSlots.where((s) => s['available'] == true).length;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Availability Schedule'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Slots',
            onPressed: _loadAvailability,
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/provider-dashboard');
              break;
            case 1:
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
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 2,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard, color: AppTheme.primaryColor), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.schedule_outlined), selectedIcon: Icon(Icons.schedule, color: AppTheme.primaryColor), label: 'Schedule'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet, color: AppTheme.primaryColor), label: 'Earnings'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble, color: AppTheme.primaryColor), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.verified_user_outlined), selectedIcon: Icon(Icons.verified_user, color: AppTheme.primaryColor), label: 'Credentials'),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading availability slots')
                : _error != null
                    ? ErrorStateWidget(message: _error, onRetry: _loadAvailability)
                    : _timeSlots.isEmpty
                        ? const ErrorStateWidget(
                            message: 'No availability slots defined.',
                            icon: Icons.calendar_today_outlined,
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(18, 16, 18, 100),
                            children: [
                              // Availability Summary Card
                              Container(
                                padding: const EdgeInsets.all(18),
                                decoration: BoxDecoration(
                                  color: theme.cardColor,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: isDark ? const Color(0xFF334155) : AppTheme.borderColor,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.03),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.all(8),
                                              decoration: BoxDecoration(
                                                color: AppTheme.primaryLight,
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: const Icon(
                                                Icons.event_available_rounded,
                                                size: 22,
                                                color: AppTheme.primaryColor,
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                const Text(
                                                  'Today\'s Hours',
                                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                                ),
                                                Text(
                                                  '$activeCount of ${_timeSlots.length} slots accepting patients',
                                                  style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: activeCount > 0 ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(20),
                                          ),
                                          child: Text(
                                            activeCount > 0 ? 'ON DUTY' : 'OFFLINE',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: activeCount > 0 ? const Color(0xFF15803D) : const Color(0xFF64748B),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 14),
                                    const Divider(height: 1),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () => _toggleAll(true),
                                            style: OutlinedButton.styleFrom(
                                              visualDensity: VisualDensity.compact,
                                              side: BorderSide(
                                                color: isDark ? const Color(0xFF334155) : AppTheme.borderColor,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                            ),
                                            child: const Text('Open All Slots', style: TextStyle(fontSize: 12)),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () => _toggleAll(false),
                                            style: OutlinedButton.styleFrom(
                                              visualDensity: VisualDensity.compact,
                                              side: BorderSide(
                                                color: isDark ? const Color(0xFF334155) : AppTheme.borderColor,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                            ),
                                            child: const Text('Close All Slots', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 18),
                              const Text(
                                'Scheduled Time Slots',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 10),

                              // Slot Cards
                              ..._timeSlots.asMap().entries.map((entry) {
                                final idx = entry.key;
                                final slot = entry.value;
                                final isAvailable = slot['available'] == true;

                                return Semantics(
                                  label: 'Time Slot on ${slot['date']} at ${slot['time']}. Currently ${isAvailable ? 'available' : 'unavailable'}',
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                    decoration: BoxDecoration(
                                      color: theme.cardColor,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isAvailable
                                            ? AppTheme.primaryColor.withValues(alpha: 0.3)
                                            : (isDark ? const Color(0xFF334155) : AppTheme.borderColor),
                                        width: isAvailable ? 1.5 : 1.0,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.02),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 42,
                                          height: 42,
                                          decoration: BoxDecoration(
                                            color: isAvailable
                                                ? AppTheme.primaryLight
                                                : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9)),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            Icons.access_time_rounded,
                                            size: 20,
                                            color: isAvailable ? AppTheme.primaryColor : const Color(0xFF94A3B8),
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                slot['time'] ?? 'Time Slot',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                              ),
                                              const SizedBox(height: 3),
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: isAvailable ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Text(
                                                      isAvailable ? 'AVAILABLE' : 'OFF-DUTY',
                                                      style: TextStyle(
                                                        fontSize: 9,
                                                        fontWeight: FontWeight.bold,
                                                        color: isAvailable ? const Color(0xFF15803D) : const Color(0xFF64748B),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    slot['date'] ?? '',
                                                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        Switch(
                                          value: isAvailable,
                                          onChanged: (val) => _toggleSlot(idx),
                                          activeColor: theme.primaryColor,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
          ),
        ],
      ),
    );
  }
}
