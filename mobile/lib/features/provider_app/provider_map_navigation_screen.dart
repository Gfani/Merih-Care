import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/location/location_tracking_service.dart';
import '../../core/location/location_service.dart';
import '../../core/location/road_routing_service.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';
import '../auth/auth_provider.dart';

class ProviderMapNavigationScreen extends ConsumerStatefulWidget {
  final String appointmentId;

  // Optional pre-resolved patient coordinates (passed from caller when available)
  final double? patientLat;
  final double? patientLon;
  final String? patientName;

  const ProviderMapNavigationScreen({
    super.key,
    required this.appointmentId,
    this.patientLat,
    this.patientLon,
    this.patientName,
  });

  @override
  ConsumerState<ProviderMapNavigationScreen> createState() =>
      _ProviderMapNavigationScreenState();
}

class _ProviderMapNavigationScreenState
    extends ConsumerState<ProviderMapNavigationScreen> {
  final MapController _mapController = MapController();
  final Distance _distanceCalculator = const Distance();

  bool _permissionGranted = false;
  bool _loading = true;
  bool _patientLocationResolved = false;

  // Real GPS Coordinates (Default Addis Ababa center)
  double _providerLat = 9.0192;
  double _providerLon = 38.7578;

  // Patient Destination — resolved from appointment data
  double _patientLat = 9.0054;
  double _patientLon = 38.7845;
  String _patientName = 'Patient';
  String? _patientAddress;

  // Road Routing Data (OSRM driving path along actual streets)
  List<LatLng> _routePoints = [];
  String? _currentInstruction;
  bool _isRouting = false;

  double _distance = 2.4;
  int _eta = 8;

  StreamSubscription? _locationSub;

  // Addis Ababa landmark coordinates dictionary for offline/instant address resolution
  static final Map<String, LatLng> _addisLandmarks = {
    'bole': const LatLng(9.0054, 38.7845),
    'bole medhanealem': const LatLng(9.0016, 38.7836),
    'bole airport': const LatLng(8.9806, 38.7997),
    'kazanchis': const LatLng(9.0185, 38.7725),
    'kazanchis menahereya': const LatLng(9.0192, 38.7730),
    'piazza': const LatLng(9.0345, 38.7523),
    'piassa': const LatLng(9.0345, 38.7523),
    'sarbet': const LatLng(8.9950, 38.7420),
    'sar bet': const LatLng(8.9950, 38.7420),
    'megenagna': const LatLng(9.0205, 38.8020),
    'mexico': const LatLng(9.0125, 38.7455),
    'mexico square': const LatLng(9.0125, 38.7455),
    '22 mazoria': const LatLng(9.0175, 38.7885),
    'hayahulet': const LatLng(9.0175, 38.7885),
    'cmc': const LatLng(9.0210, 38.8350),
    'arada': const LatLng(9.0350, 38.7550),
    'gullele': const LatLng(9.0600, 38.7300),
    'kirkos': const LatLng(9.0080, 38.7600),
    'nifas silk': const LatLng(8.9700, 38.7400),
    'nefas silk': const LatLng(8.9700, 38.7400),
    'kolfe': const LatLng(9.0100, 38.7100),
    'kolfe keranio': const LatLng(9.0100, 38.7100),
    'akaki': const LatLng(8.8800, 38.7800),
    'lideta': const LatLng(9.0100, 38.7350),
    'yeka': const LatLng(9.0300, 38.8000),
    'gotera': const LatLng(8.9900, 38.7600),
    'gerji': const LatLng(8.9950, 38.8050),
    'summit': const LatLng(9.0150, 38.8500),
    'ayat': const LatLng(9.0250, 38.8650),
    'lebu': const LatLng(8.9600, 38.7200),
    'jomo': const LatLng(8.9450, 38.7150),
    'kera': const LatLng(8.9950, 38.7500),
    'meskel square': const LatLng(9.0105, 38.7635),
    'sidist kilo': const LatLng(9.0480, 38.7620),
    'arat kilo': const LatLng(9.0330, 38.7630),
    'shola': const LatLng(9.0250, 38.7950),
    'tor hailoch': const LatLng(9.0100, 38.7200),
    'addis ketema': const LatLng(9.0300, 38.7350),
    'merkato': const LatLng(9.0290, 38.7380),
    'mercato': const LatLng(9.0290, 38.7380),
    'legetafo': const LatLng(9.0600, 38.8800),
    'lamberet': const LatLng(9.0350, 38.8100),
  };

  static LatLng? _extractLatLngFromString(String text) {
    final coordRegEx = RegExp(r'(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)');
    final match = coordRegEx.firstMatch(text);
    if (match != null) {
      final lat = double.tryParse(match.group(1)!);
      final lon = double.tryParse(match.group(2)!);
      if (lat != null && lon != null && lat.abs() <= 90 && lon.abs() <= 180) {
        return LatLng(lat, lon);
      }
    }

    final lower = text.toLowerCase();
    for (final entry in _addisLandmarks.entries) {
      if (lower.contains(entry.key)) {
        return entry.value;
      }
    }
    return null;
  }

  IconData _getTurnIcon(String instruction) {
    final lower = instruction.toLowerCase();
    if (lower.contains('left')) return Icons.turn_left_rounded;
    if (lower.contains('right')) return Icons.turn_right_rounded;
    if (lower.contains('u-turn') || lower.contains('uturn')) {
      return Icons.u_turn_left_rounded;
    }
    if (lower.contains('roundabout') || lower.contains('rotary')) {
      return Icons.roundabout_right_rounded;
    }
    if (lower.contains('arrive') || lower.contains('destination')) {
      return Icons.pin_drop_rounded;
    }
    return Icons.navigation_rounded;
  }

  @override
  void initState() {
    super.initState();
    // Apply immediately if coordinates were passed in by the caller
    if (widget.patientLat != null && widget.patientLon != null) {
      _patientLat = widget.patientLat!;
      _patientLon = widget.patientLon!;
      _patientName = widget.patientName ?? 'Patient';
      _patientLocationResolved = true;
      _updateRoadRoute();
    }
    _initTracking();
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  /// Calculates the shortest road driving route along real streets to the patient
  Future<void> _updateRoadRoute() async {
    if (_isRouting) return;
    _isRouting = true;
    try {
      final route = await RoadRoutingService.getRoute(
        start: LatLng(_providerLat, _providerLon),
        destination: LatLng(_patientLat, _patientLon),
      );
      if (!mounted) return;
      setState(() {
        _routePoints = route.points;
        _distance = route.distanceKm;
        _eta = route.etaMinutes;
        if (route.nextTurnInstruction != null &&
            route.nextTurnInstruction!.isNotEmpty) {
          _currentInstruction = route.nextTurnInstruction;
        }
      });
    } catch (_) {
      _calculateDistanceAndEta();
    } finally {
      _isRouting = false;
    }
  }

  /// Fetch real patient location from the appointment record.
  Future<void> _fetchPatientLocation() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/appointments/${widget.appointmentId}');
      final raw = res.data;
      final data = (raw is Map && raw.containsKey('data')) ? raw['data'] : raw;
      if (data == null) {
        if (!_patientLocationResolved && mounted) {
          setState(() => _patientLocationResolved = true);
          _updateRoadRoute();
        }
        return;
      }

      final pName = (data['patient'] is Map ? data['patient']['name'] : null) ??
          data['patientName'] ??
          'Patient';
      final addressStr =
          data['location']?.toString() ?? data['address']?.toString() ?? '';

      // Priority 1: direct coordinates on appointment
      double? lat = _toDouble(data['latitude']) ??
          _toDouble(data['patientLatitude']) ??
          _toDouble(data['lat']) ??
          _toDouble(data['patientLat']);
      double? lng = _toDouble(data['longitude']) ??
          _toDouble(data['patientLongitude']) ??
          _toDouble(data['lng']) ??
          _toDouble(data['patientLng']);

      // Priority 2: nested location object or coordinates map
      if ((lat == null || lng == null) && data['location'] is Map) {
        final loc = data['location'] as Map;
        lat = _toDouble(loc['latitude']) ?? _toDouble(loc['lat']) ?? lat;
        lng = _toDouble(loc['longitude']) ?? _toDouble(loc['lng']) ?? lng;
      }
      if ((lat == null || lng == null) && data['coordinates'] is Map) {
        final loc = data['coordinates'] as Map;
        lat = _toDouble(loc['latitude']) ?? _toDouble(loc['lat']) ?? lat;
        lng = _toDouble(loc['longitude']) ?? _toDouble(loc['lng']) ?? lng;
      }

      // Priority 3: extract coordinates or landmark from address text
      if ((lat == null || lng == null) && addressStr.isNotEmpty) {
        final parsed = _extractLatLngFromString(addressStr);
        if (parsed != null) {
          lat = parsed.latitude;
          lng = parsed.longitude;
        }
      }

      // Priority 4: patient's last known location via /locations/:id
      if (lat == null || lng == null) {
        final patientId = (data['patient'] is Map
                ? data['patient']['id']?.toString()
                : null) ??
            data['patientId']?.toString();
        if (patientId != null &&
            patientId.isNotEmpty &&
            patientId != 'pat-user') {
          try {
            final locRes = await client.dio.get('/locations/$patientId');
            final locData = locRes.data is Map
                ? (locRes.data['data'] ?? locRes.data)
                : {};
            lat = _toDouble(locData['latitude']) ??
                _toDouble(locData['lat']) ??
                lat;
            lng = _toDouble(locData['longitude']) ??
                _toDouble(locData['lng']) ??
                lng;
          } catch (_) {}
        }
      }

      if (mounted) {
        setState(() {
          if (lat != null && lng != null && lat != 0.0 && lng != 0.0) {
            _patientLat = lat;
            _patientLon = lng;
          }
          _patientName = pName.toString();
          if (addressStr.isNotEmpty && addressStr != 'Addis Ababa') {
            _patientAddress = addressStr;
          }
          _patientLocationResolved = true;
        });

        await _updateRoadRoute();
        _fitBothMarkers();
      }
    } catch (_) {
      if (mounted && !_patientLocationResolved) {
        setState(() => _patientLocationResolved = true);
        _updateRoadRoute();
      }
    }
  }

  Future<void> _initTracking() async {
    final service = ref.read(locationTrackingProvider);
    final granted = await service.requestPermissions();

    if (mounted) {
      setState(() {
        _permissionGranted = granted;
        _loading = false;
      });

      if (granted) {
        // Auto-detect current hardware GPS location
        final detected = await ref
            .read(locationProvider.notifier)
            .autoDetectCurrentLocation();
        if (detected != null && mounted) {
          setState(() {
            _providerLat = detected.latitude;
            _providerLon = detected.longitude;
          });
          _updateRoadRoute();
        }

        // Fetch the real patient location from the appointment record
        await _fetchPatientLocation();

        // Start streaming hardware GPS coordinates
        final client = ref.read(apiClientProvider);
        final realtime = ref.read(realtimeServiceProvider);
        final socket = realtime.socket ?? await service.ensureSocket();

        final authUser = ref.read(authProvider).user;
        final provId = authUser?['provider']?['id']?.toString() ??
            authUser?['providerId']?.toString() ??
            authUser?['id']?.toString() ??
            '';

        service.setAppointmentId(widget.appointmentId);
        realtime.joinAppointment(widget.appointmentId);

        if (socket != null) {
          service.startTracking(
            provId,
            socket,
            client: client,
            realtimeService: realtime,
            appointmentId: widget.appointmentId,
          );
        }

        // Listen to live GPS stream and update provider marker & route
        _locationSub = service.locationStream.listen((position) {
          if (!mounted) return;
          setState(() {
            _providerLat = position.latitude;
            _providerLon = position.longitude;
          });
          _updateRoadRoute();

          try {
            _mapController.move(
              LatLng(_providerLat, _providerLon),
              _mapController.camera.zoom,
            );
          } catch (_) {}
        });
      }
    }
  }

  void _calculateDistanceAndEta() {
    final double meter = _distanceCalculator.as(
      LengthUnit.Meter,
      LatLng(_providerLat, _providerLon),
      LatLng(_patientLat, _patientLon),
    );
    _distance = meter / 1000.0;
    _eta = max(1, (_distance * 3.0).round());
  }

  Future<void> _moveToMyLocation() async {
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content:
                    Text('Location services are disabled. Please enable GPS.')),
          );
        }
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permissions are denied.')),
          );
        }
        return;
      }

      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 6),
        );
      } catch (_) {
        try {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 4),
          );
        } catch (_) {
          position = await Geolocator.getLastKnownPosition();
        }
      }

      final pos = position;
      if (pos != null && mounted) {
        setState(() {
          _providerLat = pos.latitude;
          _providerLon = pos.longitude;
        });
        _updateRoadRoute();
        _mapController.move(LatLng(pos.latitude, pos.longitude), 15.0);

        final tracker = ref.read(locationTrackingProvider);
        await tracker.emitDirectCoordinates(
          pos.latitude,
          pos.longitude,
          accuracy: pos.accuracy,
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('📍 Map centered on your current location'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not retrieve current location: $e')),
        );
      }
    }
  }

  void _fitBothMarkers() {
    try {
      if (_routePoints.length > 1) {
        double minLat = _routePoints.first.latitude;
        double maxLat = _routePoints.first.latitude;
        double minLon = _routePoints.first.longitude;
        double maxLon = _routePoints.first.longitude;
        for (final p in _routePoints) {
          if (p.latitude < minLat) minLat = p.latitude;
          if (p.latitude > maxLat) maxLat = p.latitude;
          if (p.longitude < minLon) minLon = p.longitude;
          if (p.longitude > maxLon) maxLon = p.longitude;
        }
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds(LatLng(minLat, minLon), LatLng(maxLat, maxLon)),
            padding: const EdgeInsets.only(top: 80, left: 40, right: 40, bottom: 150),
          ),
        );
      } else {
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds(
              LatLng(_providerLat, _providerLon),
              LatLng(_patientLat, _patientLon),
            ),
            padding: const EdgeInsets.only(top: 80, left: 40, right: 40, bottom: 150),
          ),
        );
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    ref.read(locationTrackingProvider).stopTracking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Navigating to $_patientName'),
        actions: [
          IconButton(
            icon: const Icon(Icons.fit_screen),
            tooltip: 'Fit route in view',
            onPressed: _fitBothMarkers,
          ),
          IconButton(
            icon: const Icon(Icons.my_location),
            tooltip: 'Re-center GPS',
            onPressed: _moveToMyLocation,
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : !_permissionGranted
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.location_off_outlined,
                                  size: 64, color: Colors.red),
                              const SizedBox(height: 16),
                              const Text(
                                'Location Permission Required',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Please enable location permissions in settings to navigate and stream your arrival ETA to the patient.',
                                style: TextStyle(
                                    color: Color(0xFF64748B), height: 1.4),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton(
                                onPressed: _initTracking,
                                child: const Text('Grant Permission'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Stack(
                        children: [
                          // Real OpenStreetMap FlutterMap Canvas
                          FlutterMap(
                            mapController: _mapController,
                            options: MapOptions(
                              initialCenter: LatLng(_providerLat, _providerLon),
                              initialZoom: 14.5,
                            ),
                            children: [
                              TileLayer(
                                urlTemplate:
                                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                userAgentPackageName: 'com.merihcare.app',
                              ),
                              PolylineLayer(
                                polylines: [
                                  // Outer road path outline for high visibility
                                  Polyline(
                                    points: _routePoints.isNotEmpty
                                        ? _routePoints
                                        : [
                                            LatLng(_providerLat, _providerLon),
                                            LatLng(_patientLat, _patientLon),
                                          ],
                                    color: const Color(0xFF042F2E).withOpacity(0.35),
                                    strokeWidth: 7.0,
                                  ),
                                  // Active navigation path along real streets
                                  Polyline(
                                    points: _routePoints.isNotEmpty
                                        ? _routePoints
                                        : [
                                            LatLng(_providerLat, _providerLon),
                                            LatLng(_patientLat, _patientLon),
                                          ],
                                    color: const Color(0xFF0D7C6A),
                                    strokeWidth: 4.5,
                                  ),
                                ],
                              ),
                              MarkerLayer(
                                markers: [
                                  // Provider Marker (Live GPS)
                                  Marker(
                                    point: LatLng(_providerLat, _providerLon),
                                    width: 44,
                                    height: 44,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.blue.shade600,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                            color: Colors.white, width: 2.5),
                                        boxShadow: const [
                                          BoxShadow(
                                            color: Colors.black26,
                                            blurRadius: 6,
                                            offset: Offset(0, 3),
                                          ),
                                        ],
                                      ),
                                      child: const Icon(Icons.navigation,
                                          color: Colors.white, size: 22),
                                    ),
                                  ),
                                  // Patient Marker (Real Location)
                                  Marker(
                                    point: LatLng(_patientLat, _patientLon),
                                    width: 60,
                                    height: 60,
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade700,
                                            borderRadius:
                                                BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            _patientName.split(' ').first,
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 9,
                                                fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                        Container(
                                          width: 36,
                                          height: 36,
                                          decoration: BoxDecoration(
                                            color: Colors.red.shade600,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                                color: Colors.white, width: 2.5),
                                            boxShadow: const [
                                              BoxShadow(
                                                color: Colors.black26,
                                                blurRadius: 6,
                                                offset: Offset(0, 3),
                                              ),
                                            ],
                                          ),
                                          child: const Icon(Icons.home,
                                              color: Colors.white, size: 20),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),

                          // Patient location status badge (Green when resolved, Amber while locating)
                          Positioned(
                            top: 16,
                            left: 16,
                            child: _patientLocationResolved
                                ? Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                          color: const Color(0xFF10B981)),
                                      boxShadow: const [
                                        BoxShadow(
                                            color: Colors.black12,
                                            blurRadius: 4,
                                            offset: Offset(0, 2)),
                                      ],
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.check_circle_rounded,
                                            size: 13,
                                            color: Color(0xFF059669)),
                                        SizedBox(width: 5),
                                        Text(
                                          'Exact Patient Location',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                              color: Color(0xFF065F46)),
                                        ),
                                      ],
                                    ),
                                  )
                                : Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.amber.shade50,
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                          color: Colors.amber.shade300),
                                      boxShadow: const [
                                        BoxShadow(
                                            color: Colors.black12,
                                            blurRadius: 4,
                                            offset: Offset(0, 2)),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.amber.shade700,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Locating patient…',
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                              color: Colors.amber.shade800),
                                        ),
                                      ],
                                    ),
                                  ),
                          ),

                          // Live GPS badge
                          Positioned(
                            top: 16,
                            right: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.95),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Colors.black12,
                                      blurRadius: 4,
                                      offset: Offset(0, 2)),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: Colors.green,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'LIVE GPS',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 11,
                                        color: Color(0xFF1E293B)),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Turn-by-turn Navigation Guidance Banner
                          if (_currentInstruction != null &&
                              _currentInstruction!.isNotEmpty)
                            Positioned(
                              top: 56,
                              left: 16,
                              right: 16,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(14),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 10,
                                      offset: Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF0D7C6A),
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                        _getTurnIcon(_currentInstruction!),
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Text(
                                            'ROAD NAVIGATION',
                                            style: TextStyle(
                                              color: Color(0xFF94A3B8),
                                              fontSize: 9,
                                              letterSpacing: 0.5,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            _currentInstruction!,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                          // Fit-both-markers Button
                          Positioned(
                            bottom: 170,
                            right: 20,
                            child: FloatingActionButton.small(
                              heroTag: 'nav_fit_both',
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF0D7C6A),
                              tooltip: 'Fit route in view',
                              onPressed: _fitBothMarkers,
                              child: const Icon(Icons.fit_screen, size: 20),
                            ),
                          ),

                          // Recenter GPS Button
                          Positioned(
                            bottom: 120,
                            right: 20,
                            child: FloatingActionButton.small(
                              heroTag: 'nav_gps_detect',
                              backgroundColor: Colors.white,
                              foregroundColor: theme.primaryColor,
                              tooltip: 'Auto-detect current GPS location',
                              onPressed: _moveToMyLocation,
                              child: const Icon(Icons.my_location, size: 20),
                            ),
                          ),

                          // HUD Panel
                          Positioned(
                            bottom: 24,
                            left: 20,
                            right: 20,
                            child: Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.12),
                                    blurRadius: 16,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'APPROACHING ${_patientName.toUpperCase()}',
                                          style: const TextStyle(
                                              color: Color(0xFF8A9AAA),
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        if (_patientAddress != null &&
                                            _patientAddress!.isNotEmpty)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(top: 2),
                                            child: Text(
                                              _patientAddress!,
                                              style: const TextStyle(
                                                color: Color(0xFF334155),
                                                fontSize: 12,
                                                fontWeight: FontWeight.w500,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Text(
                                              '$_eta min',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 24,
                                                  color: Color(0xFF0D7C6A)),
                                            ),
                                            const SizedBox(width: 12),
                                            Text(
                                              '•  ${_distance.toStringAsFixed(1)} km',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 16,
                                                  color: Color(0xFF4A5A6A)),
                                            ),
                                            if (_routePoints.length > 2) ...[
                                              const SizedBox(width: 8),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 6,
                                                        vertical: 2),
                                                decoration: BoxDecoration(
                                                  color:
                                                      const Color(0xFFF0FDF4),
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                  border: Border.all(
                                                      color: const Color(
                                                          0xFF86EFAC)),
                                                ),
                                                child: const Text(
                                                  'Road Route',
                                                  style: TextStyle(
                                                    color: Color(0xFF166534),
                                                    fontSize: 10,
                                                    fontWeight:
                                                        FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundColor:
                                        const Color(0xFFF1F5F9),
                                    child: IconButton(
                                      icon: const Icon(Icons.close,
                                          color: Color(0xFF64748B)),
                                      onPressed: () => context.pop(),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}
