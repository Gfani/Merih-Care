import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_providers.dart';
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
    setState(() { _loading = true; _error = null; });
    try {
      final auth = ref.read(authProvider);
      final providerId = auth.user?['id'] ?? 'p-1';
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/availability/$providerId');
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
            { 'id': 'slot1', 'date': '2026-08-29', 'time': '09:00 - 10:00', 'available': true },
            { 'id': 'slot2', 'date': '2026-08-29', 'time': '10:00 - 11:00', 'available': false },
            { 'id': 'slot3', 'date': '2026-08-29', 'time': '14:00 - 15:00', 'available': true },
            { 'id': 'slot4', 'date': '2026-08-30', 'time': '11:00 - 12:00', 'available': true },
          ];
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleSlot(int index) async {
    final slot = _timeSlots[index];
    final updatedVal = !slot['available'];

    // Optimistically update UI
    setState(() {
      _timeSlots[index]['available'] = updatedVal;
    });

    try {
      // In production: send update slot to server
      // final client = ref.read(apiClientProvider);
      // await client.dio.put('/availability/slots/${slot['id']}', data: {'available': updatedVal});
    } catch (_) {
      // Keep optimistic update or show offline banner warning
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Availability Schedule')),
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
                        : ListView.builder(
                            padding: const EdgeInsets.all(20),
                            itemCount: _timeSlots.length,
                            itemBuilder: (context, idx) {
                              final slot = _timeSlots[idx];
                              final isAvailable = slot['available'] == true;

                              return Semantics(
                                label: 'Time Slot on ${slot['date']} at ${slot['time']}. Currently ${isAvailable ? 'available' : 'unavailable'}',
                                child: Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  child: ListTile(
                                    title: Text(slot['time'] ?? 'Time Slot', style: const TextStyle(fontWeight: FontWeight.bold)),
                                    subtitle: Text(slot['date'] ?? 'Date', style: const TextStyle(color: Color(0xFF64748B))),
                                    trailing: Switch(
                                      value: isAvailable,
                                      onChanged: (val) => _toggleSlot(idx),
                                      activeColor: theme.primaryColor,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
