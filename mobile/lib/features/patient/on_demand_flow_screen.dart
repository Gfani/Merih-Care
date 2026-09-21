import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:dio/dio.dart';
import '../../core/theme/app_theme.dart';
import '../../core/location/location_service.dart';
import '../../core/network/network_providers.dart';
import '../auth/auth_provider.dart';
import '../../shared/widgets/create_design_widgets.dart';
import '../../shared/widgets/spot_search_sheet.dart';
import '../../shared/widgets/custom_map_markers.dart';

enum OnDemandStep {
  serviceSelect,
  findingProvider,
  providerMatched,
  liveTracking,
  providerArrived,
  inProgress,
  payment,
  rateProvider,
  canceled,
}

class OnDemandFlowScreen extends ConsumerStatefulWidget {
  final String? initialAppointmentId;
  const OnDemandFlowScreen({super.key, this.initialAppointmentId});

  @override
  ConsumerState<OnDemandFlowScreen> createState() => _OnDemandFlowScreenState();
}

class _OnDemandFlowScreenState extends ConsumerState<OnDemandFlowScreen> with TickerProviderStateMixin {
  OnDemandStep _currentStep = OnDemandStep.serviceSelect;
  Map<String, dynamic>? _selectedService;
  String _locationAddress = 'Near Edna Mall, Cameroon St, Bole, Addis Ababa';
  final TextEditingController _notesController = TextEditingController();

  // Map & Telemetry Coordinates
  late final MapController _mapController;
  double _patientLat = 9.0192;
  double _patientLon = 38.7578;

  // Active Candidate State in Cascade
  double? _candidateLat;
  double? _candidateLon;
  String? _candidateName;
  String? _candidateAvatar;
  String? _candidateSpecialty;
  int _candidateEtaMinutes = 5;
  double _candidateDistanceKm = 1.2;
  List<LatLng> _routePoints = [];
  List<Map<String, dynamic>> _nearbyProviders = [];

  // Stream Subscriptions
  StreamSubscription? _dispatchSub;
  StreamSubscription? _locationSub;
  StreamSubscription? _aptSub;
  final CancelToken _cancelToken = CancelToken();

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
    'etaMinutes': 5,
    'distanceKm': 1.2,
    'phone': '+251 91 122 3344',
    'verified': true,
  };

  final List<Map<String, dynamic>> _onDemandServices = [
    {
      'id': 'doctor-visit',
      'name': 'Doctor Home Visit',
      'description': 'Comprehensive medical checkup & consultation at your doorstep.',
      'icon': Icons.medical_services_outlined,
      'color': Color(0xFFE6F5F2),
      'price': 800,
      'duration': '45 min',
    },
    {
      'id': 'home-nursing',
      'name': 'Urgent Nursing Care',
      'description': 'Wound dressing, IV therapy, vitals checking & injections.',
      'icon': Icons.favorite_border,
      'color': Color(0xFFFEF3C7),
      'price': 450,
      'duration': '30 min',
    },
    {
      'id': 'physiotherapy',
      'name': 'Physiotherapy Session',
      'description': 'Mobility recovery, rehabilitation & pain relief therapy.',
      'icon': Icons.directions_run,
      'color': Color(0xFFE8F1FB),
      'price': 600,
      'duration': '60 min',
    },
    {
      'id': 'elderly-care',
      'name': 'Elderly & Palliative Care',
      'description': 'Assistance with mobility, hygiene & daily medical monitoring.',
      'icon': Icons.elderly_outlined,
      'color': Color(0xFFF5E6FF),
      'price': 500,
      'duration': '60 min',
    },
  ];

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _selectedService = _onDemandServices.first;

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = ref.read(locationProvider).location;
      if (loc != null) {
        setState(() {
          _locationAddress = loc.address;
          _patientLat = loc.latitude;
          _patientLon = loc.longitude;
        });
      }

      _fetchNearbyProviders();
      _setupSocketListeners();

      if (widget.initialAppointmentId != null && widget.initialAppointmentId!.isNotEmpty) {
        _createdAppointmentId = widget.initialAppointmentId;
        _loadExistingAppointment(widget.initialAppointmentId!);
      }
    });
  }

  Future<void> _fetchNearbyProviders() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/locations', cancelToken: _cancelToken);
      final dynamic data = res.data;
      final List list = (data is List) ? data : (data is Map && data['data'] is List ? data['data'] as List : []);
      if (mounted) {
        setState(() {
          _nearbyProviders = list
              .whereType<Map<String, dynamic>>()
              .where((loc) => loc['role'] == 'provider' || loc['role'] == null)
              .toList();
        });
      }
    } catch (_) {
      if (mounted && _nearbyProviders.isEmpty) {
        setState(() {
          _nearbyProviders = [
            {'name': 'Dr. Meron Alemu', 'specialty': 'Doctor Home Visit', 'latitude': _patientLat + 0.007, 'longitude': _patientLon + 0.005, 'role': 'provider'},
            {'name': 'Nurse Hana T.', 'specialty': 'Urgent Nursing Care', 'latitude': _patientLat - 0.005, 'longitude': _patientLon + 0.006, 'role': 'provider'},
            {'name': 'Dr. Dawit K.', 'specialty': 'Physiotherapy', 'latitude': _patientLat + 0.003, 'longitude': _patientLon - 0.006, 'role': 'provider'},
          ];
        });
      }
    }
  }

  void _setupSocketListeners() {
    final realtime = ref.read(realtimeServiceProvider);

    // 1. Dispatch Cascade Updates (Candidate Offers, Cascade Transitions, Acceptance)
    _dispatchSub = realtime.dispatchUpdatesStream.listen((data) {
      if (!mounted) return;
      final aptId = data['appointmentId']?.toString();
      if (_createdAppointmentId != null && aptId != null && aptId != _createdAppointmentId) return;

      final status = data['status']?.toString();
      if (status == 'searching') {
        final pName = data['providerName']?.toString();
        final pLat = (data['providerLat'] as num?)?.toDouble();
        final pLng = (data['providerLng'] as num?)?.toDouble();
        final etaMin = (data['etaMinutes'] as num?)?.toInt() ?? 5;
        final distKm = (data['distanceKm'] as num?)?.toDouble() ?? 1.2;

        List<LatLng> pts = [];
        if (data['routePoints'] is List) {
          pts = (data['routePoints'] as List).map((pt) {
            return LatLng((pt['lat'] as num).toDouble(), (pt['lng'] as num).toDouble());
          }).toList();
        } else if (pLat != null && pLng != null) {
          pts = [LatLng(pLat, pLng), LatLng(_patientLat, _patientLon)];
        }

        setState(() {
          _candidateName = pName ?? 'Nearby Clinician';
          _candidateAvatar = data['providerAvatar']?.toString();
          _candidateSpecialty = data['providerSpecialty']?.toString();
          _candidateLat = pLat;
          _candidateLon = pLng;
          _candidateEtaMinutes = etaMin;
          _candidateDistanceKm = distKm;
          _routePoints = pts;
        });

        // Center map to show both candidate and patient smoothly
        if (pLat != null && pLng != null) {
          final midLat = (_patientLat + pLat) / 2;
          final midLng = (_patientLon + pLng) / 2;
          _mapController.move(LatLng(midLat, midLng), 14.2);
        }
      } else if (status == 'accepted') {
        final pName = data['providerName']?.toString();
        final pLat = (data['providerLat'] as num?)?.toDouble();
        final pLng = (data['providerLng'] as num?)?.toDouble();
        final etaMin = (data['etaMinutes'] as num?)?.toInt() ?? 4;
        final distKm = (data['distanceKm'] as num?)?.toDouble() ?? 1.0;

        List<LatLng> pts = [];
        if (data['routePoints'] is List) {
          pts = (data['routePoints'] as List).map((pt) {
            return LatLng((pt['lat'] as num).toDouble(), (pt['lng'] as num).toDouble());
          }).toList();
        }

        setState(() {
          _matchedProvider['id'] = data['providerId']?.toString() ?? 'p-1';
          _matchedProvider['name'] = pName ?? 'Assigned Clinician';
          _matchedProvider['phone'] = data['providerPhone']?.toString() ?? '+251 91 122 3344';
          _matchedProvider['avatar'] = data['providerAvatar']?.toString() ?? _matchedProvider['avatar'];
          _matchedProvider['title'] = data['providerSpecialty']?.toString() ?? _matchedProvider['title'];
          _matchedProvider['etaMinutes'] = etaMin;
          _matchedProvider['distanceKm'] = distKm;

          _candidateName = pName;
          _candidateLat = pLat;
          _candidateLon = pLng;
          _candidateEtaMinutes = etaMin;
          _candidateDistanceKm = distKm;
          if (pts.isNotEmpty) _routePoints = pts;

          _currentStep = OnDemandStep.providerMatched;
        });

        if (pLat != null && pLng != null) {
          _mapController.move(LatLng((_patientLat + pLat) / 2, (_patientLon + pLng) / 2), 14.6);
        }
      }
    });

    // 2. Real-Time Telemetry Coordinates Streaming
    _locationSub = realtime.locationUpdatesStream.listen((data) {
      if (!mounted) return;
      final lat = (data['lat'] as num?)?.toDouble() ?? (data['latitude'] as num?)?.toDouble();
      final lng = (data['lng'] as num?)?.toDouble() ?? (data['longitude'] as num?)?.toDouble();
      if (lat != null && lng != null) {
        setState(() {
          _candidateLat = lat;
          _candidateLon = lng;
          if (_routePoints.isNotEmpty) {
            _routePoints[0] = LatLng(lat, lng);
          }
        });
      }
    });

    // 3. Appointment Lifecycle Updates
    _aptSub = realtime.appointmentUpdatesStream.listen((data) {
      if (!mounted) return;
      final aptId = (data['id'] ?? data['appointmentId'])?.toString();
      if (_createdAppointmentId != null && aptId != null && aptId != _createdAppointmentId) return;

      final status = (data['status'] ?? '').toString().toLowerCase().trim();
      setState(() {
        if (status == 'accepted') {
          _currentStep = OnDemandStep.providerMatched;
        } else if (status == 'on_the_way') {
          _currentStep = OnDemandStep.liveTracking;
        } else if (status == 'arrived') {
          _currentStep = OnDemandStep.providerArrived;
        } else if (status == 'in_progress') {
          _startVisitTimer();
          _currentStep = OnDemandStep.inProgress;
        } else if (status == 'completed') {
          _currentStep = OnDemandStep.rateProvider;
        } else if (status == 'cancelled') {
          _currentStep = OnDemandStep.canceled;
        }
      });
    });
  }

  Future<void> _loadExistingAppointment(String aptId) async {
    try {
      final client = ref.read(apiClientProvider);
      final check = await client.dio.get('/appointments/$aptId', cancelToken: _cancelToken);
      final dynamic checkData = check.data;
      final Map<String, dynamic>? apt = (checkData is Map<String, dynamic>)
          ? (checkData.containsKey('data') && checkData['data'] is Map<String, dynamic> ? checkData['data'] : checkData)
          : null;

      if (apt != null && mounted) {
        final status = apt['status']?.toString();
        if (apt['providerName'] != null) {
          _matchedProvider['id'] = apt['providerId']?.toString() ?? 'p-1';
          _matchedProvider['name'] = apt['providerName']?.toString() ?? 'Assigned Clinician';
          _matchedProvider['phone'] = apt['providerPhone']?.toString() ?? '+251 91 122 3344';
        }
        if (apt['location'] != null && apt['location'].toString().isNotEmpty) {
          _locationAddress = apt['location'].toString();
        }

        setState(() {
          if (status == 'cancelled') {
            _currentStep = OnDemandStep.canceled;
          } else if (status == 'searching' || status == 'requested' || status == 'pending') {
            _currentStep = OnDemandStep.findingProvider;
            _startPolling();
          } else if (status == 'accepted' || status == 'scheduled') {
            _currentStep = OnDemandStep.providerMatched;
            _startPolling();
          } else if (status == 'on_the_way') {
            _currentStep = OnDemandStep.liveTracking;
            _startPolling();
          } else if (status == 'arrived') {
            _currentStep = OnDemandStep.providerArrived;
            _startPolling();
          } else if (status == 'in_progress') {
            _startVisitTimer();
            _startPolling();
          } else if (status == 'completed') {
            _currentStep = OnDemandStep.rateProvider;
          }
        });
      }
    } catch (e) {
      print('[DISPATCH] Error loading existing appointment: $e');
    }
  }

  @override
  void dispose() {
    _cancelToken.cancel('Widget disposed');
    _pulseController.dispose();
    _searchTimer?.cancel();
    _visitTimer?.cancel();
    _dispatchSub?.cancel();
    _locationSub?.cancel();
    _aptSub?.cancel();
    _notesController.dispose();
    _reviewController.dispose();
    super.dispose();
  }

  Future<void> _startFindingProvider() async {
    setState(() {
      _currentStep = OnDemandStep.findingProvider;
      _searchSeconds = 0;
    });

    // Dispatch real care appointment request to backend
    try {
      final client = ref.read(apiClientProvider);
      final authState = ref.read(authProvider);
      final user = authState.user;
      final patientId = user?['id']?.toString();
      final patientName = user?['name']?.toString() ?? (user?['email']?.toString().split('@')[0] ?? 'Patient');
      final patientPhone = user?['phone']?.toString();
      final now = DateTime.now();

      final payload = <String, dynamic>{
        if (patientId != null && patientId.isNotEmpty && patientId != 'pat-user') 'patientId': patientId,
        'patientName': patientName,
        if (patientPhone != null && patientPhone.isNotEmpty) 'patientPhone': patientPhone,
        'serviceId': _selectedService?['id'] ?? 'doctor-visit',
        'service': _selectedService?['name'] ?? 'Doctor Home Visit',
        'date': now.toIso8601String().split('T')[0],
        'time': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
        'location': _locationAddress,
        'latitude': _patientLat,
        'longitude': _patientLon,
        'notes': _notesController.text.trim(),
        'amount': (_selectedService?['price'] ?? 800) is num ? (_selectedService?['price'] as num).toDouble() : 800.0,
        'status': 'searching',
      };

      final res = await client.dio.post('/appointments', data: payload, cancelToken: _cancelToken);

      final dynamic resData = res.data;
      final Map<String, dynamic>? data = (resData is Map<String, dynamic>)
          ? (resData.containsKey('data') && resData['data'] is Map<String, dynamic> ? resData['data'] : resData)
          : null;

      if (data != null && data['id'] != null) {
        _createdAppointmentId = data['id'].toString();
      }
    } catch (e) {
      print('[DISPATCH] Error creating real appointment: $e');
    }

    _startPolling();
  }

  void _startPolling() {
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
          final check = await client.dio.get('/appointments/$_createdAppointmentId', cancelToken: _cancelToken);
          final dynamic checkData = check.data;
          final Map<String, dynamic>? apt = (checkData is Map<String, dynamic>)
              ? (checkData.containsKey('data') && checkData['data'] is Map<String, dynamic> ? checkData['data'] : checkData)
              : null;

          if (apt != null) {
            final status = apt['status']?.toString();
            if (apt['providerName'] != null) {
              _matchedProvider['id'] = apt['providerId']?.toString() ?? 'p-1';
              _matchedProvider['name'] = apt['providerName']?.toString() ?? 'Assigned Clinician';
              _matchedProvider['phone'] = apt['providerPhone']?.toString() ?? '+251 91 122 3344';
            }

            if (status == 'cancelled') {
              timer.cancel();
              setState(() => _currentStep = OnDemandStep.canceled);
            } else if (status == 'accepted' || status == 'scheduled') {
              timer.cancel();
              setState(() => _currentStep = OnDemandStep.providerMatched);
            } else if (status == 'on_the_way') {
              timer.cancel();
              setState(() => _currentStep = OnDemandStep.liveTracking);
            }
          }
        } catch (_) {}
      }
    });
  }

  void _startVisitTimer() {
    _visitTimer?.cancel();
    _visitTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _visitSeconds++);
    });
  }

  void _handleBackNavigation() {
    if (_currentStep == OnDemandStep.serviceSelect) {
      context.pop();
    } else if (_currentStep == OnDemandStep.findingProvider) {
      _confirmAndCancel();
    } else {
      context.go('/dashboard');
    }
  }

  Future<void> _confirmAndCancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Care Request?'),
        content: const Text('Are you sure you want to stop matching and cancel this care request?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep Searching'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorColor),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Cancel Request', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      _searchTimer?.cancel();
      _visitTimer?.cancel();
      if (_createdAppointmentId != null) {
        try {
          final client = ref.read(apiClientProvider);
          await client.dio.post('/appointments/$_createdAppointmentId/cancel', data: {
            'reason': 'Patient cancelled on-demand request',
          });
        } catch (e) {
          print('[DISPATCH] Error cancelling appointment: $e');
        }
      }
      if (mounted) {
        setState(() => _currentStep = OnDemandStep.canceled);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMapStage = _currentStep == OnDemandStep.serviceSelect ||
        _currentStep == OnDemandStep.findingProvider ||
        _currentStep == OnDemandStep.providerMatched ||
        _currentStep == OnDemandStep.liveTracking;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBackNavigation();
      },
      child: Scaffold(
        backgroundColor: AppTheme.surfaceColor,
        body: isMapStage ? _buildFullMapScreen() : SafeArea(child: _buildCurrentPostMapStep()),
      ),
    );
  }

  // ─── FULL-SCREEN UBER-STYLE MAP CANVAS + BOTTOM SHEET ─────────────────────────

  Widget _buildFullMapScreen() {
    return Stack(
      children: [
        // 1. Full Screen Interactive FlutterMap
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: LatLng(_patientLat, _patientLon),
            initialZoom: 14.5,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.merihcare.mobile',
            ),

            // Pulsing Search Radius Highlight during Matching
            if (_currentStep == OnDemandStep.findingProvider)
              CircleLayer(
                circles: [
                  CircleMarker(
                    point: LatLng(_patientLat, _patientLon),
                    radius: 1400,
                    useRadiusInMeter: true,
                    color: const Color(0xFF0D7C6A).withValues(alpha: 0.12),
                    borderColor: const Color(0xFF0D7C6A).withValues(alpha: 0.45),
                    borderStrokeWidth: 2.0,
                  ),
                ],
              ),

            // Shortest Path Road Route Polyline
            if (_routePoints.isNotEmpty)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: _routePoints,
                    color: const Color(0xFF0D7C6A),
                    strokeWidth: 4.5,
                    borderColor: Colors.white,
                    borderStrokeWidth: 1.5,
                  ),
                ],
              ),

            // Markers Layer: Patient Pin, Nearby Providers, Active Candidate & Floating ETA
            MarkerLayer(
              markers: [
                // Patient Home Pin
                Marker(
                  point: LatLng(_patientLat, _patientLon),
                  width: 80,
                  height: 70,
                  child: const PatientHomeMarker(label: 'Your Location'),
                ),

                // Nearby Available Clinicians
                ..._nearbyProviders.map((prov) {
                  final lat = (prov['latitude'] ?? prov['y'] as num?)?.toDouble() ?? 0.0;
                  final lng = (prov['longitude'] ?? prov['x'] as num?)?.toDouble() ?? 0.0;
                  if (lat == 0.0 || lng == 0.0) return null;
                  final isCurrentCandidate = _candidateLat != null &&
                      (lat - _candidateLat!).abs() < 0.0001 &&
                      (lng - _candidateLon!).abs() < 0.0001;
                  return Marker(
                    point: LatLng(lat, lng),
                    width: 50,
                    height: 50,
                    child: ClinicianMapMarker(
                      name: prov['name']?.toString(),
                      avatarUrl: prov['avatar']?.toString(),
                      isSelected: isCurrentCandidate,
                    ),
                  );
                }).whereType<Marker>(),

                // Active Offer Candidate or En-Route Clinician with Floating ETA Badge
                if (_candidateLat != null && _candidateLon != null) ...[
                  Marker(
                    point: LatLng(_candidateLat!, _candidateLon!),
                    width: 54,
                    height: 54,
                    child: ClinicianMapMarker(
                      name: _candidateName,
                      avatarUrl: _candidateAvatar,
                      isSelected: true,
                      isEnRoute: _currentStep == OnDemandStep.liveTracking || _currentStep == OnDemandStep.providerMatched,
                    ),
                  ),
                  // Floating ETA Badge anchored directly above provider pin
                  Marker(
                    point: LatLng(_candidateLat! + 0.0018, _candidateLon!),
                    width: 140,
                    height: 36,
                    child: Center(
                      child: FloatingEtaBadge(
                        etaText: '$_candidateEtaMinutes min',
                        distanceText: '${_candidateDistanceKm.toStringAsFixed(1)} km',
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),

        // 2. Floating Top Header & Action Controls
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                // Back Button
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 3))],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppTheme.textPrimary),
                    onPressed: _handleBackNavigation,
                  ),
                ),
                const SizedBox(width: 10),

                // Location Spot Header Pill
                Expanded(
                  child: InkWell(
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => SpotSearchSheet(
                          onSpotSelected: (spot) {
                            setState(() {
                              _locationAddress = spot.address;
                              _patientLat = spot.latitude;
                              _patientLon = spot.longitude;
                              _mapController.move(LatLng(_patientLat, _patientLon), 15.0);
                            });
                          },
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(30),
                        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 3))],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on, color: Color(0xFF0D7C6A), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _locationAddress,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            ),
                          ),
                          const Icon(Icons.search, size: 16, color: Colors.grey),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // Recenter GPS Button
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 3))],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.my_location, size: 18, color: Color(0xFF0D7C6A)),
                    onPressed: () => _mapController.move(LatLng(_patientLat, _patientLon), 15.0),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 3. Draggable Bottom Sheet
        _buildDraggableBottomSheet(),
      ],
    );
  }

  Widget _buildDraggableBottomSheet() {
    double initialSize = 0.38;
    double minSize = 0.22;
    double maxSize = 0.65;

    if (_currentStep == OnDemandStep.findingProvider) {
      initialSize = 0.28;
      minSize = 0.20;
      maxSize = 0.35;
    } else if (_currentStep == OnDemandStep.providerMatched || _currentStep == OnDemandStep.liveTracking) {
      initialSize = 0.36;
      minSize = 0.25;
      maxSize = 0.50;
    }

    return DraggableScrollableSheet(
      initialChildSize: initialSize,
      minChildSize: minSize,
      maxChildSize: maxSize,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 16, offset: Offset(0, -4))],
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag Handle
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 8),
                    width: 38,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                if (_currentStep == OnDemandStep.serviceSelect)
                  _buildBottomSheetServiceSelect()
                else if (_currentStep == OnDemandStep.findingProvider)
                  _buildBottomSheetSearching()
                else if (_currentStep == OnDemandStep.providerMatched || _currentStep == OnDemandStep.liveTracking)
                  _buildBottomSheetEnRoute(),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─── BOTTOM SHEET: 1. SERVICE SELECT ──────────────────────────────────────────

  Widget _buildBottomSheetServiceSelect() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Select Care Service',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
              ),
              Text(
                '${_nearbyProviders.length} nearby online',
                style: const TextStyle(fontSize: 12, color: Color(0xFF0D7C6A), fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Horizontal Service Options Carousel
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _onDemandServices.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final svc = _onDemandServices[index];
                final isSelected = _selectedService?['id'] == svc['id'];

                return InkWell(
                  onTap: () => setState(() => _selectedService = svc),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    width: 152,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFE6F5F2) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF0D7C6A) : Colors.grey.shade200,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Icon(svc['icon'] as IconData, size: 20, color: const Color(0xFF0D7C6A)),
                            Text(
                              'ETB ${svc['price']}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: Color(0xFF0D7C6A)),
                            ),
                          ],
                        ),
                        Text(
                          svc['name'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary),
                        ),
                        Text(
                          'Est. ${svc['duration']}',
                          style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 14),

          // Primary Dispatch Action Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D7C6A),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _startFindingProvider,
              child: Text(
                'Request ${_selectedService?['name'] ?? 'Care'} (ETB ~${_selectedService?['price'] ?? 800})',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  // ─── BOTTOM SHEET: 2. SEARCHING & DISPATCH CASCADE ───────────────────────────

  Widget _buildBottomSheetSearching() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        children: [
          Row(
            children: [
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, _) {
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF0D7C6A).withValues(alpha: (1.0 - _pulseController.value) * 0.4),
                        ),
                      ),
                      Container(
                        width: 34,
                        height: 34,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF0D7C6A),
                        ),
                        child: const Icon(Icons.radar, color: Colors.white, size: 18),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Searching for nearby clinicians...',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _candidateName != null
                          ? 'Dispatching offer to $_candidateName (${_candidateSpecialty ?? 'Clinician'}, ~${_candidateDistanceKm.toStringAsFixed(1)} km, ETA ~$_candidateEtaMinutes min)'
                          : 'Broadcasting to verified providers within 10 km... (${_searchSeconds}s)',
                      style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.errorColor),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _confirmAndCancel,
                  child: const Text('Cancel Request', style: TextStyle(color: AppTheme.errorColor, fontWeight: FontWeight.bold, fontSize: 12.5)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextButton(
                  onPressed: () => context.go('/dashboard'),
                  child: const Text('Background Mode', style: TextStyle(color: Color(0xFF0D7C6A), fontSize: 12.5)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── BOTTOM SHEET: 3. PROVIDER EN ROUTE ───────────────────────────────────────

  Widget _buildBottomSheetEnRoute() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Clinician En Route',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F5F2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'ETA ~$_candidateEtaMinutes min',
                  style: const TextStyle(color: Color(0xFF0D7C6A), fontWeight: FontWeight.bold, fontSize: 11.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Provider Profile Row
          Row(
            children: [
              AvatarWidget(name: _matchedProvider['name'], radius: 24, verified: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_matchedProvider['name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    Text(_matchedProvider['title'] ?? 'Care Specialist', style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted)),
                    const SizedBox(height: 2),
                    RatingWidget(rating: _matchedProvider['rating'], reviewCount: _matchedProvider['reviewCount']),
                  ],
                ),
              ),
              IconButton(
                style: IconButton.styleFrom(backgroundColor: const Color(0xFFE6F5F2)),
                icon: const Icon(Icons.call, color: Color(0xFF0D7C6A), size: 20),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Calling ${_matchedProvider['phone']}...')),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Action Buttons: Open Live Chat & Cancel
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D7C6A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16, color: Colors.white),
                  label: const Text('Open Live Chat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  onPressed: () {
                    if (_createdAppointmentId != null) {
                      context.push('/chat/$_createdAppointmentId');
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Chat session connecting...')),
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.errorColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _confirmAndCancel,
                child: const Text('Cancel', style: TextStyle(color: AppTheme.errorColor, fontSize: 12.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── POST-MAP WORKFLOW SCREENS (Arrived, In Progress, Payment, Rating) ────────

  Widget _buildCurrentPostMapStep() {
    switch (_currentStep) {
      case OnDemandStep.providerArrived:
        return _buildProviderArrived();
      case OnDemandStep.inProgress:
        return _buildInProgress();
      case OnDemandStep.payment:
        return _buildPayment();
      case OnDemandStep.rateProvider:
        return _buildRateProvider();
      case OnDemandStep.canceled:
        return _buildCanceledScreen();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildProviderArrived() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: const BoxDecoration(color: Color(0xFFE6F5F2), shape: BoxShape.circle),
            child: const Icon(Icons.door_front_door_outlined, color: Color(0xFF0D7C6A), size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Clinician Has Arrived!', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            '${_matchedProvider['name']} is at your doorstep with medical supplies.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () {
                _startVisitTimer();
                setState(() => _currentStep = OnDemandStep.inProgress);
              },
              child: const Text('Start Treatment Visit'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInProgress() {
    final minutes = _visitSeconds ~/ 60;
    final seconds = _visitSeconds % 60;
    final timeStr = '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: const BoxDecoration(color: Color(0xFFE6F5F2), shape: BoxShape.circle),
            child: const Icon(Icons.medical_services_rounded, color: Color(0xFF0D7C6A), size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Care Session in Progress', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Visit Elapsed Time: $timeStr', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0D7C6A))),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () {
                _visitTimer?.cancel();
                setState(() => _currentStep = OnDemandStep.payment);
              },
              child: const Text('Complete Session & Pay'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPayment() {
    final price = _selectedService?['price'] ?? 800;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Service Payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Select payment method for your home care visit.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total Amount', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Text('ETB $price', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0D7C6A))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildPaymentRadio('telebirr', 'Telebirr SuperApp', Icons.phone_android),
          _buildPaymentRadio('cbe_birr', 'CBE Birr', Icons.account_balance),
          _buildPaymentRadio('cash', 'Cash to Clinician', Icons.payments_outlined),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => setState(() => _currentStep = OnDemandStep.rateProvider),
              child: const Text('Confirm Payment'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRadio(String val, String label, IconData icon) {
    final isSelected = _selectedPaymentMethod == val;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isSelected ? const Color(0xFF0D7C6A) : Colors.grey.shade200, width: isSelected ? 2 : 1),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF0D7C6A)),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
        trailing: Radio<String>(
          value: val,
          groupValue: _selectedPaymentMethod,
          activeColor: const Color(0xFF0D7C6A),
          onChanged: (newVal) => setState(() => _selectedPaymentMethod = newVal!),
        ),
      ),
    );
  }

  Widget _buildRateProvider() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AvatarWidget(name: _matchedProvider['name'], radius: 36, verified: true),
          const SizedBox(height: 14),
          Text('How was your visit with ${_matchedProvider['name']}?', textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (idx) {
              final star = idx + 1;
              return IconButton(
                icon: Icon(star <= _selectedRating ? Icons.star_rounded : Icons.star_outline_rounded, color: Colors.amber, size: 36),
                onPressed: () => setState(() => _selectedRating = star.toDouble()),
              );
            }),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => context.go('/dashboard'),
              child: const Text('Submit Review & Done'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCanceledScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 74,
              height: 74,
              decoration: BoxDecoration(color: AppTheme.errorColor.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: const Icon(Icons.cancel_outlined, size: 44, color: AppTheme.errorColor),
            ),
            const SizedBox(height: 20),
            const Text('Request Canceled', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Your care request has been canceled. You can request a new clinician anytime.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppTheme.textMuted)),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => context.go('/dashboard'),
                child: const Text('Return to Home'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
