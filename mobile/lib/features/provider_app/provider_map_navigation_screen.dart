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

  double _distance = 2.4;
  int _eta = 8;

  StreamSubscription? _locationSub;

  @override
  void initState() {
    super.initState();
    // Apply immediately if coordinates were passed in by the caller
    if (widget.patientLat != null && widget.patientLon != null) {
      _patientLat = widget.patientLat!;
      _patientLon = widget.patientLon!;
      _patientName = widget.patientName ?? 'Patient';
      _patientLocationResolved = true;
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

  /// Fetch real patient location from the appointment record.
  Future<void> _fetchPatientLocation() async {
    if (_patientLocationResolved) return;
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/appointments/${widget.appointmentId}');
      final raw = res.data;
      final data = (raw is Map && raw.containsKey('data')) ? raw['data'] : raw;
      if (data == null) return;

      final pName = (data['patient'] is Map ? data['patient']['name'] : null) ??
          data['patientName'] ??
          'Patient';

      // Priority 1: direct coordinates on appointment
      double? lat = _toDouble(data['latitude']) ??
          _toDouble(data['patientLatitude']);
      double? lng = _toDouble(data['longitude']) ??
          _toDouble(data['patientLongitude']);

      // Priority 2: nested location object
      if ((lat == null || lng == null) && data['location'] is Map) {
        final loc = data['location'] as Map;
        lat = _toDouble(loc['latitude']) ?? _toDouble(loc['lat']) ?? lat;
        lng = _toDouble(loc['longitude']) ?? _toDouble(loc['lng']) ?? lng;
      }

      // Priority 3: patient's last known location via /locations/:id
      if (lat == null || lng == null) {
        final patientId = (data['patient'] is Map
                ? data['patient']['id']?.toString()
                : null) ??
            data['patientId']?.toString();
        if (patientId != null && patientId.isNotEmpty) {
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

      if (mounted && lat != null && lng != null) {
        setState(() {
          _patientLat = lat!;
          _patientLon = lng!;
          _patientName = pName.toString();
          _patientLocationResolved = true;
          _calculateDistanceAndEta();
        });
        // Zoom to show both markers
        try {
          _mapController.fitCamera(
            CameraFit.bounds(
              bounds: LatLngBounds(
                LatLng(_providerLat, _providerLon),
                LatLng(_patientLat, _patientLon),
              ),
              padding: const EdgeInsets.all(60),
            ),
          );
        } catch (_) {}
      }
    } catch (_) {}
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
        final detected =
            await ref.read(locationProvider.notifier).autoDetectCurrentLocation();
        if (detected != null && mounted) {
          setState(() {
            _providerLat = detected.latitude;
            _providerLon = detected.longitude;
            _calculateDistanceAndEta();
          });
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

        // Listen to live GPS stream and update provider marker
        _locationSub = service.locationStream.listen((position) {
          if (!mounted) return;
          setState(() {
            _providerLat = position.latitude;
            _providerLon = position.longitude;
            _calculateDistanceAndEta();
          });

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
          _calculateDistanceAndEta();
        });
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
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds(
            LatLng(_providerLat, _providerLon),
            LatLng(_patientLat, _patientLon),
          ),
          padding: const EdgeInsets.all(60),
        ),
      );
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
            tooltip: 'Fit both markers in view',
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
                                userAgentPackageName: 'com.merihcare.mobile',
                              ),
                              PolylineLayer(
                                polylines: [
                                  Polyline(
                                    points: [
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

                          // Patient location resolving indicator
                          if (!_patientLocationResolved)
                            Positioned(
                              top: 16,
                              left: 16,
                              child: Container(
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

                          // Fit-both-markers Button
                          Positioned(
                            bottom: 170,
                            right: 20,
                            child: FloatingActionButton.small(
                              heroTag: 'nav_fit_both',
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF0D7C6A),
                              tooltip: 'Fit both markers in view',
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
