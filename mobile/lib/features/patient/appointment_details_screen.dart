import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';

class AppointmentDetailsScreen extends ConsumerStatefulWidget {
  final String appointmentId;

  const AppointmentDetailsScreen({super.key, required this.appointmentId});

  @override
  ConsumerState<AppointmentDetailsScreen> createState() => _AppointmentDetailsScreenState();
}

class _AppointmentDetailsScreenState extends ConsumerState<AppointmentDetailsScreen> {
  Map<String, dynamic>? _appt;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments/details/${widget.appointmentId}');
      if (mounted) {
        setState(() {
          _appt = response.data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
        });
        toast('Unable to load appointment details. Please check your connection.', 'error');
      }
    }
  }

  Future<void> _cancelAppointment() async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.put('/appointments/${widget.appointmentId}/cancel');
      if (mounted) {
        toast('Appointment cancelled successfully', 'info');
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        toast('Failed to cancel appointment. Please check your network and try again.', 'error');
      }
    }
  }

  void toast(String message, String type) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: type == 'error' ? Colors.red : Colors.teal),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final provider = _appt?['provider'] ?? {};
    final status = (_appt?['status'] ?? 'SCHEDULED').toString().toUpperCase();
    final canCancel = status == 'SCHEDULED' || status == 'ACCEPTED';

    return Scaffold(
      appBar: AppBar(title: const Text('Booking Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: theme.primaryColor.withOpacity(0.1),
                    child: Icon(Icons.person, color: theme.primaryColor),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(provider['name'] ?? 'Healthcare Provider', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(provider['specialty'] ?? 'Specialist', style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text('CARE SCHEDULE', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
            const SizedBox(height: 8),
            _buildDetailRow(Icons.calendar_today, 'Date', _appt?['date'] ?? ''),
            _buildDetailRow(Icons.access_time, 'Time Slot', _appt?['time'] ?? ''),
            _buildDetailRow(Icons.phone, 'Provider Contact', (_appt?['providerPhone'] ?? provider['phone'] ?? '+251 91 123 4567').toString()),
            _buildDetailRow(Icons.map, 'Address', _appt?['address'] ?? ''),
            _buildDetailRow(Icons.payment, 'Amount Paid', 'ETB ${_appt?['amount'] ?? 0}'),
            _buildDetailRow(Icons.info_outline, 'Status', status),
            const SizedBox(height: 20),
            const Text('PATIENT NOTES', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
              child: Text(_appt?['notes'] ?? 'No notes provided.', style: const TextStyle(color: Color(0xFF4A5A6A))),
            ),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    button: true,
                    label: 'Call provider directly',
                    child: ElevatedButton.icon(
                      onPressed: () {
                        final phone = (_appt?['providerPhone'] ?? provider['phone'] ?? '+251 91 123 4567').toString();
                        Clipboard.setData(ClipboardData(text: phone));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Provider phone $phone copied! Dialing...'),
                            backgroundColor: const Color(0xFF0F766E),
                          ),
                        );
                      },
                      icon: const Icon(Icons.phone, size: 18),
                      label: const Text('Call Provider'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    button: true,
                    label: 'Chat with provider',
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/chat/${widget.appointmentId}'),
                      icon: const Icon(Icons.chat_bubble_outline, size: 18),
                      label: const Text('Chat'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (canCancel) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      button: true,
                      label: 'Reschedule appointment',
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/appointment/${widget.appointmentId}/reschedule'),
                        icon: const Icon(Icons.calendar_month_outlined),
                        label: const Text('Reschedule'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.primaryColor,
                          side: BorderSide(color: theme.primaryColor),
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      button: true,
                      label: 'Cancel appointment',
                      child: OutlinedButton(
                        onPressed: _cancelAppointment,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF8A9AAA)),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 11)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
        ],
      ),
    );
  }
}
