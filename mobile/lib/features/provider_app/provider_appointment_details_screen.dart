import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/connectivity/offline_queue_service.dart';
import '../../core/connectivity/connectivity_service.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/offline_banner.dart';

class ProviderAppointmentDetailsScreen extends ConsumerStatefulWidget {
  final String appointmentId;

  const ProviderAppointmentDetailsScreen({super.key, required this.appointmentId});

  @override
  ConsumerState<ProviderAppointmentDetailsScreen> createState() => _ProviderAppointmentDetailsScreenState();
}

class _ProviderAppointmentDetailsScreenState extends ConsumerState<ProviderAppointmentDetailsScreen> {
  Map<String, dynamic>? _appointment;
  bool _loading = true;
  String? _error;
  bool _updatingStatus = false;
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments/${widget.appointmentId}');
      if (mounted) {
        setState(() {
          _appointment = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _appointment = null;
          _error = 'Unable to load appointment details. Please try again.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _changeStatus(String newStatus, {String? notes}) async {
    setState(() => _updatingStatus = true);

    final isOnline = await checkIsOnline();
    if (!isOnline) {
      // Offline Queueing fallback
      await OfflineQueueService.instance.queueOperation(
        '/appointments/${widget.appointmentId}/status',
        'PUT',
        {'status': newStatus, 'visitNotes': notes},
      );
      if (mounted) {
        setState(() {
          _appointment!['status'] = newStatus;
          if (notes != null) _appointment!['visitNotes'] = notes;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline: Action queued. Will sync when back online.'), backgroundColor: Colors.orange),
        );
      }
      setState(() => _updatingStatus = false);
      return;
    }

    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.put('/appointments/${widget.appointmentId}/status', data: {
        'status': newStatus,
        'visitNotes': notes,
      });
      if (mounted) {
        setState(() {
          _appointment = response.data;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to: ${_getStatusLabel(newStatus)}'), backgroundColor: Colors.teal),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingStatus = false);
    }
  }

  void _showCompleteVisitDialog() {
    showDialog(
      context: context,
      builder: (ctx) => Semantics(
        label: 'Submit visit completion notes dialog',
        child: AlertDialog(
          title: const Text('Complete Visit'),
          content: TextField(
            controller: _notesController,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Enter care summary, diagnoses, or notes...',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _changeStatus('completed', notes: _notesController.text);
              },
              child: const Text('Submit & Complete'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = _appointment?['status'] ?? 'scheduled';

    return Scaffold(
      appBar: AppBar(title: const Text('Care Visit Details')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading visit details')
                : _error != null
                    ? ErrorStateWidget(message: _error, onRetry: _loadDetails)
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Status bar indicator
                            _buildProgressStepper(status),
                            const SizedBox(height: 24),
                            // Care Card info
                            Semantics(
                              label: 'Patient name: ${_appointment?['patientName'] ?? ''}',
                              child: Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(20),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            _appointment?['patient']?['name'] ??
                                                _appointment?['patientName'] ??
                                                'Patient',
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.phone, color: Color(0xFF0D7C6A)),
                                            onPressed: () {},
                                            tooltip: 'Call Patient',
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      _buildInfoRow(Icons.medical_services_outlined, _appointment?['service'] ?? 'Service'),
                                      const SizedBox(height: 8),
                                      _buildInfoRow(Icons.calendar_today_outlined, '${_appointment?['date']} at ${_appointment?['time']}'),
                                      const SizedBox(height: 8),
                                      _buildInfoRow(Icons.location_on_outlined, _appointment?['location'] ?? 'Location'),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            const Text('PATIENT / INTAKE NOTES', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
                            const SizedBox(height: 8),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                              child: Text(_appointment?['notes'] ?? 'No special intake notes provided.', style: const TextStyle(color: Color(0xFF4A5A6A), height: 1.4)),
                            ),
                            if (_appointment?['visitNotes'] != null) ...[
                              const SizedBox(height: 24),
                              const Text('VISIT OUTCOME NOTES', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
                              const SizedBox(height: 8),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(10)),
                                child: Text(_appointment?['visitNotes'], style: const TextStyle(color: Color(0xFF065F46), height: 1.4)),
                              ),
                            ],
                            const SizedBox(height: 32),
                            // FSM Action triggers
                            if (_updatingStatus)
                              const Center(child: CircularProgressIndicator())
                            else
                              _buildActionButtons(status, theme),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressStepper(String status) {
    final steps = ['accepted', 'on_the_way', 'arrived', 'in_progress', 'completed'];
    final currentIndex = steps.indexOf(status);

    return Semantics(
      label: 'Progress state: ${_getStatusLabel(status)}',
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: steps.map((s) {
            final idx = steps.indexOf(s);
            final active = idx <= currentIndex;
            return Icon(
              _getStepperIcon(s),
              color: active ? const Color(0xFF0D7C6A) : const Color(0xFFCBD5E1),
              size: 24,
            );
          }).toList(),
        ),
      ),
    );
  }

  IconData _getStepperIcon(String status) {
    switch (status) {
      case 'accepted':
        return Icons.check_circle_outline_rounded;
      case 'on_the_way':
        return Icons.navigation_outlined;
      case 'arrived':
        return Icons.place_outlined;
      case 'in_progress':
        return Icons.play_circle_outline_rounded;
      default:
        return Icons.task_alt_rounded;
    }
  }

  Widget _buildActionButtons(String status, ThemeData theme) {
    switch (status) {
      case 'accepted':
      case 'scheduled':
        return Column(
          children: [
            ElevatedButton(
              onPressed: () {
                _changeStatus('on_the_way');
                context.push('/provider/map/${widget.appointmentId}');
              },
              child: const Text('Start Travel / Head to Patient'),
            ),
          ],
        );
      case 'on_the_way':
        return Column(
          children: [
            ElevatedButton(
              onPressed: () => _changeStatus('arrived'),
              child: const Text('Arrived at Location'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => context.push('/provider/map/${widget.appointmentId}'),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Open Map Navigation'),
            ),
          ],
        );
      case 'arrived':
        return ElevatedButton(
          onPressed: () => _changeStatus('in_progress'),
          child: const Text('Start Medical Visit'),
        );
      case 'in_progress':
        return ElevatedButton(
          onPressed: _showCompleteVisitDialog,
          child: const Text('Complete Medical Visit'),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(color: Color(0xFF4A5A6A), fontSize: 13))),
      ],
    );
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'scheduled':
      case 'accepted':
        return 'Scheduled';
      case 'on_the_way':
        return 'En Route';
      case 'arrived':
        return 'Arrived';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Completed';
    }
  }
}
