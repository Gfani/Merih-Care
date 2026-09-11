import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/location/location_service.dart';
import '../auth/auth_provider.dart';

class BookingScreen extends ConsumerStatefulWidget {
  final String providerId;

  const BookingScreen({super.key, required this.providerId});

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();
  final _addressController = TextEditingController();
  
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String _selectedTime = '10:00 AM';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = ref.read(locationProvider).location;
      if (loc != null && _addressController.text.isEmpty) {
        _addressController.text = loc.fullAddress;
      }
    });
  }

  final List<String> _timeSlots = [
    '08:00 AM',
    '10:00 AM',
    '12:00 PM',
    '02:00 PM',
    '04:00 PM',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Schedule Care')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select Date', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 30)),
                  );
                  if (picked != null) {
                    setState(() => _selectedDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFE2E8EE)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${_selectedDate.year}-${_selectedDate.month}-${_selectedDate.day}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      Icon(Icons.calendar_today, color: theme.primaryColor),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Select Time Slot', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                children: _timeSlots.map((time) {
                  final selected = _selectedTime == time;
                  return ChoiceChip(
                    label: Text(time),
                    selected: selected,
                    onSelected: (val) {
                      if (val) setState(() => _selectedTime = time);
                    },
                    selectedColor: theme.primaryColor,
                    labelStyle: TextStyle(color: selected ? Colors.white : Colors.black87),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Care Location Address', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  TextButton.icon(
                    onPressed: () async {
                      final detected = await ref.read(locationProvider.notifier).autoDetectCurrentLocation();
                      if (detected != null && mounted) {
                        setState(() {
                          _addressController.text = detected.fullAddress;
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('📍 Location auto-detected: ${detected.shortAddress}'),
                            backgroundColor: theme.primaryColor,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.my_location, size: 16),
                    label: const Text('Auto-Detect GPS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _addressController,
                decoration: const InputDecoration(
                  labelText: 'Address details',
                  hintText: 'Enter subcity, house number, landmark, etc.',
                  prefixIcon: Icon(Icons.map_outlined),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter location address';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _notesController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Patient Notes / Health History',
                  hintText: 'Add descriptions of symptoms, medicines or age info...',
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _submitting
                    ? null
                    : () async {
                        if (_formKey.currentState!.validate()) {
                          setState(() => _submitting = true);
                          try {
                            final client = ref.read(apiClientProvider);
                            final auth = ref.read(authProvider);
                            final user = auth.user;
                            final patientId = user?['id']?.toString();
                            final patientName = user?['name']?.toString() ?? (user?['email']?.toString().split('@')[0] ?? 'Patient');
                            final patientPhone = user?['phone']?.toString();

                            final m = _selectedDate.month.toString().padLeft(2, '0');
                            final d = _selectedDate.day.toString().padLeft(2, '0');
                            final dateStr = '${_selectedDate.year}-$m-$d';

                            final response = await client.dio.post('/appointments/book', data: {
                              'providerId': widget.providerId,
                              'patientId': patientId,
                              'patientName': patientName,
                              'patientPhone': patientPhone,
                              'date': dateStr,
                              'time': _selectedTime,
                              'location': _addressController.text.trim(),
                              'address': _addressController.text.trim(),
                              'notes': _notesController.text.trim(),
                              'amount': 800.0,
                            });
                            setState(() => _submitting = false);
                            if (mounted) {
                              final apptId = response.data['id'] ?? 'appt-new';
                              // Direct user to secure Stripe payment flow
                              context.replace('/payment?appointmentId=$apptId');
                            }
                          } catch (err) {
                            setState(() => _submitting = false);
                            print('[BOOKING] Error booking appointment: $err');
                            if (mounted) {
                              context.replace('/appointments');
                            }
                          }
                        }
                      },
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Proceed to Payment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
