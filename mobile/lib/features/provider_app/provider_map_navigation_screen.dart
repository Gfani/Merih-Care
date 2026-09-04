import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  bool _permissionGranted = false;
  bool _loading = true;
  double _distance = 2.4; // simulated distance in KM
  int _eta = 8; // simulated ETA in mins
  Timer? _routeTimer;

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
        // Auto-detect current coordinates
        ref.read(locationProvider.notifier).autoDetectCurrentLocation();

        // Start simulated background tracking sending coordinate updates
        final client = ref.read(apiClientProvider);
        service.startTracking('p-1', client);

        // Gradually decrement distance/ETA to simulate approach
        _routeTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
          if (mounted) {
            setState(() {
              if (_distance > 0.1) {
                _distance -= 0.2;
                _eta = max(1, (_distance * 3.5).round());
              } else {
                _distance = 0.0;
                _eta = 0;
                _routeTimer?.cancel();
              }
            });
          }
        });
      }
    }
  }

  @override
  void dispose() {
    _routeTimer?.cancel();
    ref.read(locationTrackingProvider).stopTracking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Navigation to Patient')),
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
                                'Please enable location permissions in settings to navigate and update patient on arrival ETA.',
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
                          // Mock Map Canvas
                          Semantics(
                            label: 'Navigation map view showing path to patient location',
                            child: Container(
                              color: const Color(0xFFE2E8F0),
                              width: double.infinity,
                              height: double.infinity,
                              child: Stack(
                                children: [
                                  // Grid pattern mock
                                  Positioned.fill(
                                    child: CustomPaint(
                                      painter: GridPainter(),
                                    ),
                                  ),
                                  // Path Line
                                  Center(
                                    child: Container(
                                      width: 4,
                                      height: 200,
                                      color: theme.primaryColor,
                                    ),
                                  ),
                                  // Provider Pin
                                  Positioned(
                                    bottom: 120,
                                    left: MediaQuery.of(context).size.width / 2 - 16,
                                    child: Semantics(
                                      label: 'Your current location indicator',
                                      child: const Icon(Icons.navigation, color: Colors.blue, size: 32),
                                    ),
                                  ),
                                  // Patient Pin
                                  Positioned(
                                    top: 120,
                                    left: MediaQuery.of(context).size.width / 2 - 16,
                                    child: Semantics(
                                      label: 'Patient destination location pin',
                                      child: const Icon(Icons.location_on, color: Colors.red, size: 32),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Auto-detect / Recenter GPS Button
                          Positioned(
                            bottom: 120,
                            right: 24,
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
                                      _distance = 2.0;
                                      _eta = 7;
                                    });
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('📍 GPS Recenetred: ${detected.shortAddress}'),
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
                            left: 24,
                            right: 24,
                            child: Semantics(
                              label: 'Navigation HUD. ETA: $_eta minutes. Distance: ${_distance.toStringAsFixed(1)} kilometers.',
                              child: Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.1),
                                      blurRadius: 16,
                                      offset: const Offset(0, 8),
                                    )
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Text('APPROACHING PATIENT', style: TextStyle(color: Color(0xFF8A9AAA), fontSize: 10, fontWeight: FontWeight.bold)),
                                          const SizedBox(height: 6),
                                          Row(
                                            children: [
                                              Text('$_eta min', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Color(0xFF0D7C6A))),
                                              const SizedBox(width: 12),
                                              Text('•  ${_distance.toStringAsFixed(1)} km', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF4A5A6A))),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    Semantics(
                                      button: true,
                                      label: 'Exit navigation',
                                      child: CircleAvatar(
                                        radius: 24,
                                        backgroundColor: const Color(0xFFF1F5F9),
                                        child: IconButton(
                                          icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                                          onPressed: () => context.pop(),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
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

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 1.0;

    for (double i = 0; i < size.width; i += 40) {
      canvas.drawLine(Offset(i, 0), Offset(i, size.height), paint);
    }
    for (double j = 0; j < size.height; j += 40) {
      canvas.drawLine(Offset(0, j), Offset(size.width, j), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
