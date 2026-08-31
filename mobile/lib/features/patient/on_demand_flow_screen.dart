import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/location/location_service.dart';
import '../../core/network/network_providers.dart';
import '../auth/auth_provider.dart';
import '../../shared/widgets/create_design_widgets.dart';

enum OnDemandStep {
  serviceSelect,
  locationConfirm,
  requestDetails,
  summary,
  findingProvider,
  providerMatched,
  liveTracking,
  providerArrived,
  inProgress,
  payment,
  rateProvider,
}

class OnDemandFlowScreen extends ConsumerStatefulWidget {
  const OnDemandFlowScreen({super.key});

  @override
  ConsumerState<OnDemandFlowScreen> createState() => _OnDemandFlowScreenState();
}

class _OnDemandFlowScreenState extends ConsumerState<OnDemandFlowScreen> with TickerProviderStateMixin {
  OnDemandStep _currentStep = OnDemandStep.serviceSelect;
  Map<String, dynamic>? _selectedService;
  String _locationAddress = 'Bole Subcity, House 452, Addis Ababa';
  final TextEditingController _notesController = TextEditingController();
  
  int _searchSeconds = 0;
  Timer? _searchTimer;
  int _visitSeconds = 0;
  Timer? _visitTimer;
  double _selectedRating = 5.0;
  final TextEditingController _reviewController = TextEditingController();
  String _selectedPaymentMethod = 'telebirr';
  String? _createdAppointmentId;

  late AnimationController _pulseController;

  final Map<String, dynamic> _matchedProvider = {
    'id': 'p-1',
    'name': 'Assigned Clinician',
    'title': 'General Practitioner (MD)',
    'avatar': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format',
    'rating': 5.0,
    'reviewCount': 1,
    'etaMinutes': 10,
    'phone': '+251 91 122 3344',
    'verified': true,
  };

  final List<Map<String, dynamic>> _onDemandServices = [
    {
      'id': 'srv-1',
      'name': 'Doctor Home Visit',
      'description': 'Comprehensive medical checkup and consultation at your doorstep.',
      'icon': Icons.medical_services_outlined,
      'color': Color(0xFFE6F5F2),
      'price': 800,
      'duration': '45 min',
    },
    {
      'id': 'srv-2',
      'name': 'Urgent Nursing Care',
      'description': 'Wound dressing, IV therapy, vitals checking and injections.',
      'icon': Icons.favorite_border,
      'color': Color(0xFFFEF3C7),
      'price': 450,
      'duration': '30 min',
    },
    {
      'id': 'srv-3',
      'name': 'Physiotherapy Session',
      'description': 'Mobility recovery, rehabilitation, and pain relief therapy.',
      'icon': Icons.directions_run,
      'color': Color(0xFFE8F1FB),
      'price': 600,
      'duration': '60 min',
    },
    {
      'id': 'srv-4',
      'name': 'Elderly & Palliative Care',
      'description': 'Assistance with mobility, hygiene, and daily medical monitoring.',
      'icon': Icons.elderly_outlined,
      'color': Color(0xFFF5E6FF),
      'price': 500,
      'duration': '60 min',
    },
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _searchTimer?.cancel();
    _visitTimer?.cancel();
    _notesController.dispose();
    _reviewController.dispose();
    super.dispose();
  }

  Future<void> _startFindingProvider() async {
    setState(() {
      _currentStep = OnDemandStep.findingProvider;
      _searchSeconds = 0;
    });

    // 1. Dispatch real care appointment request to backend
    try {
      final client = ref.read(apiClientProvider);
      final authState = ref.read(authProvider);
      final user = authState.user;
      final patientId = user?['id']?.toString() ?? 'pat-user';
      final patientName = user?['name']?.toString() ?? (user?['email']?.toString().split('@')[0] ?? 'Patient');
      final now = DateTime.now();

      final res = await client.dio.post('/appointments', data: {
        'patientId': patientId,
        'patientName': patientName,
        'serviceId': _selectedService?['id'] ?? 'srv-1',
        'service': _selectedService?['name'] ?? 'Doctor Home Visit',
        'date': now.toIso8601String().split('T')[0],
        'time': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
        'location': _locationAddress,
        'amount': (_selectedService?['price'] ?? 800) is num ? (_selectedService?['price'] as num).toDouble() : 800.0,
        'status': 'searching',
      });

      final dynamic data = res.data;
      if (data is Map<String, dynamic> && data['id'] != null) {
        _createdAppointmentId = data['id'].toString();
      }
    } catch (e) {
      print('[DISPATCH] Error creating real appointment: $e');
    }

    // 2. Poll backend for actual doctor acceptance
    _searchTimer?.cancel();
    _searchTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _searchSeconds += 2);

      if (_createdAppointmentId != null) {
        try {
          final client = ref.read(apiClientProvider);
          final check = await client.dio.get('/appointments/$_createdAppointmentId');
          final dynamic apt = check.data;
          if (apt is Map<String, dynamic>) {
            final status = apt['status']?.toString();
            if (status == 'accepted' || status == 'scheduled' || status == 'on_the_way' || status == 'in_progress') {
              timer.cancel();
              _matchedProvider['id'] = apt['providerId']?.toString() ?? 'p-1';
              _matchedProvider['name'] = apt['providerName']?.toString() ?? 'Assigned Healthcare Provider';
              _matchedProvider['phone'] = apt['providerPhone']?.toString() ?? '+251 91 122 3344';
              setState(() => _currentStep = OnDemandStep.providerMatched);
            }
          }
        } catch (e) {
          print('[DISPATCH] Polling error: $e');
        }
      }
    });
  }

  void _startVisitTimer() {
    setState(() {
      _currentStep = OnDemandStep.inProgress;
      _visitSeconds = 0;
    });

    _visitTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _visitSeconds++);
    });
  }

  String _formatTimer(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () {
            if (_currentStep == OnDemandStep.serviceSelect) {
              context.pop();
            } else if (_currentStep == OnDemandStep.locationConfirm) {
              setState(() => _currentStep = OnDemandStep.serviceSelect);
            } else if (_currentStep == OnDemandStep.requestDetails) {
              setState(() => _currentStep = OnDemandStep.locationConfirm);
            } else if (_currentStep == OnDemandStep.summary) {
              setState(() => _currentStep = OnDemandStep.requestDetails);
            } else {
              context.go('/dashboard');
            }
          },
        ),
        title: Text(_getStepTitle()),
        actions: [
          if (_currentStep != OnDemandStep.serviceSelect && _currentStep != OnDemandStep.rateProvider)
            TextButton(
              onPressed: () => context.go('/dashboard'),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.errorColor, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
      body: SafeArea(
        child: _buildCurrentStepContent(),
      ),
    );
  }

  String _getStepTitle() {
    switch (_currentStep) {
      case OnDemandStep.serviceSelect: return 'Select Care Service';
      case OnDemandStep.locationConfirm: return 'Confirm Home Location';
      case OnDemandStep.requestDetails: return 'Care Details & Notes';
      case OnDemandStep.summary: return 'Request Summary';
      case OnDemandStep.findingProvider: return 'Matching Provider';
      case OnDemandStep.providerMatched: return 'Provider Found!';
      case OnDemandStep.liveTracking: return 'Live En-Route Tracking';
      case OnDemandStep.providerArrived: return 'Provider Arrived';
      case OnDemandStep.inProgress: return 'Care in Progress';
      case OnDemandStep.payment: return 'Service Payment';
      case OnDemandStep.rateProvider: return 'Rate & Review';
    }
  }

  Widget _buildCurrentStepContent() {
    switch (_currentStep) {
      case OnDemandStep.serviceSelect:
        return _buildServiceSelect();
      case OnDemandStep.locationConfirm:
        return _buildLocationConfirm();
      case OnDemandStep.requestDetails:
        return _buildRequestDetails();
      case OnDemandStep.summary:
        return _buildSummary();
      case OnDemandStep.findingProvider:
        return _buildFindingProvider();
      case OnDemandStep.providerMatched:
        return _buildProviderMatched();
      case OnDemandStep.liveTracking:
        return _buildLiveTracking();
      case OnDemandStep.providerArrived:
        return _buildProviderArrived();
      case OnDemandStep.inProgress:
        return _buildInProgress();
      case OnDemandStep.payment:
        return _buildPayment();
      case OnDemandStep.rateProvider:
        return _buildRateProvider();
    }
  }

  // ─── 1. SERVICE SELECT ───────────────────────────────────────────────────────
  Widget _buildServiceSelect() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'What medical assistance do you need right now?',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
        ),
        const SizedBox(height: 4),
        const Text(
          'A nearby verified professional will be dispatched to your location.',
          style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
        ),
        const SizedBox(height: 16),
        ..._onDemandServices.map((svc) {
          final isSelected = _selectedService?['id'] == svc['id'];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              onTap: () {
                setState(() => _selectedService = svc);
                setState(() => _currentStep = OnDemandStep.locationConfirm);
              },
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  border: Border.all(
                    color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor,
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: svc['color'] as Color,
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                      child: Icon(svc['icon'] as IconData, size: 26, color: AppTheme.textPrimary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            svc['name'] as String,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            svc['description'] as String,
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Text(
                                'ETB ${svc['price']}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '•  Est. ${svc['duration']}',
                                style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppTheme.borderStrong),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  // ─── 2. LOCATION CONFIRM ─────────────────────────────────────────────────────
  Widget _buildLocationConfirm() {
    final locationState = ref.watch(locationProvider);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Where should the provider visit you?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 14),
          // Interactive Map Simulation Box
          Container(
            height: 180,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8EE),
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.map_outlined, size: 40, color: AppTheme.textMuted),
                    const SizedBox(height: 6),
                    Text(
                      locationState.location?.fullAddress ?? _locationAddress,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                Positioned(
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: AppTheme.primaryColor, shape: BoxShape.circle),
                    child: const Icon(Icons.home, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            decoration: InputDecoration(
              labelText: 'Home Address & House Number',
              hintText: 'e.g. Bole Subcity, Kebele 03, House 452',
              prefixIcon: const Icon(Icons.location_on_outlined, color: AppTheme.primaryColor),
              suffixIcon: IconButton(
                icon: const Icon(Icons.my_location, color: AppTheme.primaryColor),
                onPressed: () => ref.read(locationProvider.notifier).autoDetectCurrentLocation(),
              ),
            ),
            controller: TextEditingController(text: _locationAddress),
            onChanged: (val) => _locationAddress = val,
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: () => setState(() => _currentStep = OnDemandStep.requestDetails),
            child: const Text('Confirm Location & Continue'),
          ),
        ],
      ),
    );
  }

  // ─── 3. REQUEST DETAILS ──────────────────────────────────────────────────────
  Widget _buildRequestDetails() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Describe patient symptoms or requirements', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('This helps the arriving provider prepare necessary equipment.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 16),
          TextField(
            controller: _notesController,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'e.g. Severe headache, post-op dressing change on left knee, mild fever since yesterday...',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          CardWidget(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, color: AppTheme.primaryColor, size: 20),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'All providers are board-certified and vetted with verified Ethiopian medical licenses.',
                    style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: () => setState(() => _currentStep = OnDemandStep.summary),
            child: const Text('Review Order Summary'),
          ),
        ],
      ),
    );
  }

  // ─── 4. SUMMARY ──────────────────────────────────────────────────────────────
  Widget _buildSummary() {
    final price = _selectedService?['price'] ?? 800;
    final transportFee = 100;
    final total = price + transportFee;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_selectedService?['name'] ?? 'Home Care', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const StatusBadgeWidget(status: 'searching'),
                  ],
                ),
                const Divider(height: 24, color: AppTheme.borderColor),
                _buildSummaryRow(Icons.location_on_outlined, 'Location', _locationAddress),
                const SizedBox(height: 10),
                _buildSummaryRow(Icons.notes_outlined, 'Notes', _notesController.text.isEmpty ? 'General Home Care' : _notesController.text),
                const SizedBox(height: 10),
                _buildSummaryRow(Icons.timer_outlined, 'Response Time', 'Immediate Dispatch (~10-15 mins)'),
                const Divider(height: 24, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Service Fee', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    Text('ETB $price', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Transport & Dispatch', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    Text('ETB 100', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Estimated', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.textPrimary)),
                    Text('ETB $total', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor)),
                  ],
                ),
              ],
            ),
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: _startFindingProvider,
            child: const Text('Confirm & Find Nearest Provider'),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppTheme.primaryColor),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
              Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }

  // ─── 5. FINDING PROVIDER (RADAR RIPPLE PULSE) ────────────────────────────────
  Widget _buildFindingProvider() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 140 + (_pulseController.value * 50),
                    height: 140 + (_pulseController.value * 50),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.primaryColor.withOpacity(1.0 - _pulseController.value),
                    ),
                  ),
                  Container(
                    width: 100,
                    height: 100,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.primaryColor,
                    ),
                    child: const Icon(Icons.radar, color: Colors.white, size: 48),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 36),
          const Text(
            'Finding Nearest Available Provider...',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 6),
          Text(
            'Broadcasting request to verified clinicians within 5 km ($_searchSeconds s)',
            style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
          ),
        ],
      ),
    );
  }

  // ─── 6. PROVIDER MATCHED ─────────────────────────────────────────────────────
  Widget _buildProviderMatched() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: AppTheme.successLight, shape: BoxShape.circle),
            child: const Icon(Icons.check_circle_outline, color: AppTheme.successColor, size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Care Provider Found & Dispatched!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Your provider is preparing medical kit and heading your way.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 24),
          CardWidget(
            child: Column(
              children: [
                Row(
                  children: [
                    AvatarWidget(name: _matchedProvider['name'], radius: 28, verified: true),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_matchedProvider['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          Text(_matchedProvider['title'], style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                          const SizedBox(height: 4),
                          RatingWidget(rating: _matchedProvider['rating'], reviewCount: _matchedProvider['reviewCount']),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildInfoBadge('ETA', '12 mins'),
                    _buildInfoBadge('Distance', '2.1 km'),
                    _buildInfoBadge('Status', 'En Route'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => setState(() => _currentStep = OnDemandStep.liveTracking),
            child: const Text('Track Provider Live on Map'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBadge(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
      ],
    );
  }

  // ─── 7. LIVE TRACKING ────────────────────────────────────────────────────────
  Widget _buildLiveTracking() {
    return Column(
      children: [
        Expanded(
          child: Container(
            color: const Color(0xFFE2E8EE),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.directions_car, size: 40, color: AppTheme.primaryColor),
                      SizedBox(height: 4),
                      Text('Dr. Meron is 1.2 km away on Bole Road', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                    ],
                  ),
                ),
                Positioned(
                  top: 16,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.access_time_filled, color: AppTheme.primaryColor, size: 18),
                            SizedBox(width: 8),
                            Text('Estimated Arrival in 8 min', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                        StatusBadgeWidget(status: 'on_the_way'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.white,
          child: Column(
            children: [
              Row(
                children: [
                  AvatarWidget(name: _matchedProvider['name'], radius: 22, verified: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_matchedProvider['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(_matchedProvider['phone'], style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.phone, color: AppTheme.primaryColor),
                    onPressed: () {},
                  ),
                  IconButton(
                    icon: const Icon(Icons.chat_bubble_outline, color: AppTheme.primaryColor),
                    onPressed: () => context.push('/chat/apt-101'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => setState(() => _currentStep = OnDemandStep.providerArrived),
                child: const Text('Simulate Provider Arrival'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── 8. PROVIDER ARRIVED ─────────────────────────────────────────────────────
  Widget _buildProviderArrived() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: Color(0xFFEDE9FE), shape: BoxShape.circle),
            child: const Icon(Icons.doorbell_outlined, color: Color(0xFF7C3AED), size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Dr. Meron Alemu Has Arrived!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Please greet the provider and grant entry to begin treatment.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 24),
          CardWidget(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('Appointment Safety Verification Code', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                const SizedBox(height: 6),
                const Text('8492', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: 6, color: AppTheme.primaryColor)),
                const SizedBox(height: 6),
                const Text('Share this 4-digit code with your provider upon arrival.', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _startVisitTimer,
            child: const Text('Commence Treatment / In Progress'),
          ),
        ],
      ),
    );
  }

  // ─── 9. IN PROGRESS ──────────────────────────────────────────────────────────
  Widget _buildInProgress() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: AppTheme.primaryLight, shape: BoxShape.circle),
            child: const Icon(Icons.health_and_safety_outlined, color: AppTheme.primaryColor, size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Medical Care in Progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Treatment is actively underway with your attending clinician.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 24),
          CardWidget(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const Text('Visit Duration', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                const SizedBox(height: 6),
                Text(
                  _formatTimer(_visitSeconds),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppTheme.primaryColor, letterSpacing: 2),
                ),
                const SizedBox(height: 10),
                const StatusBadgeWidget(status: 'in_progress'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              _visitTimer?.cancel();
              setState(() => _currentStep = OnDemandStep.payment);
            },
            child: const Text('Complete Treatment & Review Bill'),
          ),
        ],
      ),
    );
  }

  // ─── 10. PAYMENT ─────────────────────────────────────────────────────────────
  Widget _buildPayment() {
    final price = _selectedService?['price'] ?? 800;
    final total = price + 100;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Treatment Completed Invoice', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                const Divider(height: 20, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_selectedService?['name'] ?? 'Home Visit', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('ETB $price', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Transport & Dispatch', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('ETB 100', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const Divider(height: 20, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Due', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text('ETB $total', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Select Payment Method', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          _buildPaymentOption('telebirr', 'Telebirr', Icons.phone_android, const Color(0xFF005CAB)),
          _buildPaymentOption('cbe', 'CBE Birr', Icons.account_balance, const Color(0xFF8A1538)),
          _buildPaymentOption('chapa', 'Chapa Card (Visa/Mastercard)', Icons.credit_card, const Color(0xFF0070BA)),
          _buildPaymentOption('cash', 'Cash to Provider', Icons.attach_money, const Color(0xFF16A34A)),
          const Spacer(),
          ElevatedButton(
            onPressed: () => setState(() => _currentStep = OnDemandStep.rateProvider),
            child: Text('Pay ETB $total via ${_selectedPaymentMethod.toUpperCase()}'),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentOption(String id, String label, IconData icon, Color iconColor) {
    final isSelected = _selectedPaymentMethod == id;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => setState(() => _selectedPaymentMethod = id),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(
              color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ),
              if (isSelected) const Icon(Icons.check_circle, color: AppTheme.primaryColor, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  // ─── 11. RATE & REVIEW ───────────────────────────────────────────────────────
  Widget _buildRateProvider() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AvatarWidget(name: _matchedProvider['name'], radius: 36, verified: true),
          const SizedBox(height: 12),
          Text(_matchedProvider['name'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const Text('How was your treatment today?', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (index) {
              final star = index + 1;
              return IconButton(
                iconSize: 36,
                icon: Icon(
                  star <= _selectedRating ? Icons.star_rounded : Icons.star_border_rounded,
                  color: AppTheme.warningColor,
                ),
                onPressed: () => setState(() => _selectedRating = star.toDouble()),
              );
            }),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _reviewController,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Share your experience (e.g. Dr. Meron was punctual, gentle, and thorough)...',
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Thank you! Review submitted successfully.'), backgroundColor: AppTheme.primaryColor),
              );
              context.go('/dashboard');
            },
            child: const Text('Submit Review & Finish'),
          ),
        ],
      ),
    );
  }
}
