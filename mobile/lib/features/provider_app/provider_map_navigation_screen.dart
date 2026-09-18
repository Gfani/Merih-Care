import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import '../../core/location/location_tracking_service.dart';
import '../../core/location/location_service.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';

class ProviderMapNavigationScreen extends ConsumerStatefulWidget {
  final String appointmentId;

  const ProviderMapNavigationScreen({super.key, required this.appointmentId});

  @override
  ConsumerState<ProviderMapNavigationScreen> createState() => _ProviderMapNavigationScreenState();
}

class _ProviderMapNavigationScreenState extends ConsumerState<ProviderMapNavigationScreen> {
  final MapController _mapController = MapController();
  final Distance _distanceCalculator = const Distance();

  bool _permissionGranted = false;
  bool _loading = true;

  // Real GPS Coordinates (Default Addis Ababa center)
  double _providerLat = 9.0192;
  double _providerLon = 38.7578;

  // Patient Destination (Bole Sub City)
  final double _patientLat = 9.0054;
  final double _patientLon = 38.7845;

  double _distance = 2.4; // KM
  int _eta = 8; // Mins

  StreamSubscription? _locationSub;

  @override
  void initState() {
    super.initState();
    _initTracking();
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
        final detected = await ref.read(locationProvider.notifier).autoDetectCurrentLocation();
        if (detected != null && mounted) {
          setState(() {
            _providerLat = detected.latitude;
            _providerLon = detected.longitude;
            _calculateDistanceAndEta();
          });
        }

        // Start streaming hardware GPS coordinates
        final client = ref.read(apiClientProvider);
        final realtime = ref.read(realtimeServiceProvider);

        service.startTracking(
          providerId: 'provider-active',
          client: client,
          realtimeService: realtime,
          appointmentId: widget.appointmentId,
        );

        // Listen to live GPS stream
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
        title: const Text('Live Navigation to Patient'),
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            tooltip: 'Re-center GPS',
            onPressed: () {
              _mapController.move(LatLng(_providerLat, _providerLon), 15.0);
            },
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
                              const Icon(Icons.location_off_outlined, size: 64, color: Colors.red),
                              const SizedBox(height: 16),
                              const Text(
                                'Location Permission Required',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Please enable location permissions in settings to navigate and stream your arrival ETA to the patient.',
                                style: TextStyle(color: Color(0xFF64748B), height: 1.4),
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
                                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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
                                  // Provider Marker (Live GPS Position)
                                  Marker(
                                    point: LatLng(_providerLat, _providerLon),
                                    width: 44,
                                    height: 44,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.blue.shade600,
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.white, width: 2.5),
                                        boxShadow: const [
                                          BoxShadow(
                                            color: Colors.black26,
                                            blurRadius: 6,
                                            offset: Offset(0, 3),
                                          ),
                                        ],
                                      ),
                                      child: const Icon(Icons.navigation, color: Colors.white, size: 22),
                                    ),
                                  ),
                                  // Patient Marker (Destination)
                                  Marker(
                                    point: LatLng(_patientLat, _patientLon),
                                    width: 44,
                                    height: 44,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.red.shade600,
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.white, width: 2.5),
                                        boxShadow: const [
                                          BoxShadow(
                                            color: Colors.black26,
                                            blurRadius: 6,
                                            offset: Offset(0, 3),
                                          ),
                                        ],
                                      ),
                                      child: const Icon(Icons.location_on, color: Colors.white, size: 24),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),

                          // Live GPS Status Indicator
                          Positioned(
                            top: 16,
                            right: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.95),
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const [
                                  BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
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
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF1E293B)),
                                  ),
                                ],
                              ),
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
                              onPressed: () async {
                                final detected = await ref.read(locationProvider.notifier).autoDetectCurrentLocation();
                                if (!mounted) return;
                                if (detected != null) {
                                  setState(() {
                                    _providerLat = detected.latitude;
                                    _providerLon = detected.longitude;
                                    _calculateDistanceAndEta();
                                  });
                                  _mapController.move(LatLng(_providerLat, _providerLon), 15.0);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('📍 GPS Centered: ${detected.shortAddress}'),
                                      backgroundColor: theme.primaryColor,
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                              },
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
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Text(
                                          'APPROACHING PATIENT (LIVE ROUTE)',
                                          style: TextStyle(color: Color(0xFF8A9AAA), fontSize: 10, fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Text(
                                              '$_eta min',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Color(0xFF0D7C6A)),
                                            ),
                                            const SizedBox(width: 12),
                                            Text(
                                              '•  ${_distance.toStringAsFixed(1)} km',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF4A5A6A)),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundColor: const Color(0xFFF1F5F9),
                                    child: IconButton(
                                      icon: const Icon(Icons.close, color: Color(0xFF64748B)),
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
