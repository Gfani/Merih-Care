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
            { 'id': 'slot-0900', 'date': todayStr, 'time': '09:00 - 10:00', 'available': true },
            { 'id': 'slot-1000', 'date': todayStr, 'time': '10:00 - 11:00', 'available': true },
            { 'id': 'slot-1100', 'date': todayStr, 'time': '11:00 - 12:00', 'available': true },
            { 'id': 'slot-1400', 'date': todayStr, 'time': '14:00 - 15:00', 'available': true },
            { 'id': 'slot-1500', 'date': todayStr, 'time': '15:00 - 16:00', 'available': true },
            { 'id': 'slot-1600', 'date': todayStr, 'time': '16:00 - 17:00', 'available': true },
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

    // Optimistically update UI
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
