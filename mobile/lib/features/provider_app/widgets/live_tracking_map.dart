import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/location/road_routing_service.dart';

class LiveTrackingMap extends ConsumerStatefulWidget {
  final double? initialProviderLat;
  final double? initialProviderLon;
  final double destinationLat;
  final double destinationLon;
  final String destinationName;
  final String? destinationAddress;
  final VoidCallback? onArrived;
  final bool showArrivedButton;

  const LiveTrackingMap({
    super.key,
    this.initialProviderLat,
    this.initialProviderLon,
    required this.destinationLat,
    required this.destinationLon,
    required this.destinationName,
    this.destinationAddress,
    this.onArrived,
    this.showArrivedButton = true,
  });

  @override
  ConsumerState<LiveTrackingMap> createState() => _LiveTrackingMapState();
}

class _LiveTrackingMapState extends ConsumerState<LiveTrackingMap> {
  final MapController _mapController = MapController();
  final Distance _distanceCalculator = const Distance();

  late double _providerLat;
  late double _providerLon;
  late double _patientLat;
  late double _patientLon;

  List<LatLng> _routePoints = [];
  String? _currentInstruction;
  double _distanceKm = 2.4;
  int _etaMinutes = 10;
  bool _isRouting = false;
  StreamSubscription<Position>? _positionSub;

  @override
  void initState() {
    super.initState();
    _providerLat = widget.initialProviderLat ?? 9.0192;
    _providerLon = widget.initialProviderLon ?? 38.7578;
    _patientLat = widget.destinationLat;
    _patientLon = widget.destinationLon;

    _initGpsAndRoute();
  }

  @override
  void didUpdateWidget(covariant LiveTrackingMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.destinationLat != widget.destinationLat ||
        oldWidget.destinationLon != widget.destinationLon) {
      setState(() {
        _patientLat = widget.destinationLat;
        _patientLon = widget.destinationLon;
      });
      _fetchRoute();
    }
  }

  Future<void> _initGpsAndRoute() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.always || perm == LocationPermission.whileInUse) {
        final Position currentPos = await Geolocator.getLastKnownPosition() ??
            await Geolocator.getCurrentPosition(
              timeLimit: const Duration(seconds: 4),
            );
        if (mounted) {
          setState(() {
            _providerLat = currentPos.latitude;
            _providerLon = currentPos.longitude;
          });
        }
      }
    } catch (_) {}

    await _fetchRoute();

    // Subscribe to live GPS changes while navigating
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.always || perm == LocationPermission.whileInUse) {
        _positionSub = Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 10,
          ),
        ).listen((pos) {
          if (!mounted) return;
          final moved = _distanceCalculator.as(
            LengthUnit.Meter,
            LatLng(_providerLat, _providerLon),
            LatLng(pos.latitude, pos.longitude),
          );

          setState(() {
            _providerLat = pos.latitude;
            _providerLon = pos.longitude;
          });

          if (moved > 40) {
            _fetchRoute();
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchRoute() async {
    if (_isRouting) return;
    _isRouting = true;

    try {
      final start = LatLng(_providerLat, _providerLon);
      final dest = LatLng(_patientLat, _patientLon);

      final routeRes = await RoadRoutingService.getRoute(
        start: start,
        destination: dest,
      );

      if (mounted) {
        setState(() {
          _routePoints = routeRes.points;
          _distanceKm = routeRes.distanceKm;
          _etaMinutes = routeRes.etaMinutes;
          _currentInstruction = routeRes.nextTurnInstruction ??
              'Head towards ${widget.destinationName}';
        });

        // Frame camera to encompass both points
        WidgetsBinding.instance.addPostFrameCallback((_) => _fitBothMarkers());
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _routePoints = [
            LatLng(_providerLat, _providerLon),
            LatLng(_patientLat, _patientLon),
          ];
          final distMeters = _distanceCalculator.as(
            LengthUnit.Meter,
            LatLng(_providerLat, _providerLon),
            LatLng(_patientLat, _patientLon),
          );
          _distanceKm = (distMeters / 1000.0 * 1.3);
          _etaMinutes = ((_distanceKm / 22.0) * 60).round().clamp(2, 60);
          _currentInstruction = 'Navigating to ${widget.destinationName}';
        });
      }
    } finally {
      _isRouting = false;
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
            padding: const EdgeInsets.only(top: 90, left: 40, right: 40, bottom: 180),
          ),
        );
      } else {
        _mapController.fitCamera(
          CameraFit.bounds(
            bounds: LatLngBounds(
              LatLng(_providerLat, _providerLon),
              LatLng(_patientLat, _patientLon),
            ),
            padding: const EdgeInsets.only(top: 90, left: 40, right: 40, bottom: 180),
          ),
        );
      }
    } catch (_) {}
  }

  void _recenterOnGps() {
    try {
      _mapController.move(LatLng(_providerLat, _providerLon), 16.0);
    } catch (_) {}
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
  void dispose() {
    _positionSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final startPoint = LatLng(_providerLat, _providerLon);
    final patientPoint = LatLng(_patientLat, _patientLon);

    return Stack(
      children: [
        // ─── 1. FlutterMap OpenStreetMap Layer ─────────────────────────────────
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: startPoint,
            initialZoom: 14.5,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.merihcare.app',
            ),

            // Polyline Navigation Path
            PolylineLayer(
              polylines: [
                // Outer road outline for high contrast
                Polyline(
                  points: _routePoints.isNotEmpty
                      ? _routePoints
                      : [startPoint, patientPoint],
                  color: const Color(0xFF042F2E).withValues(alpha: 0.35),
                  strokeWidth: 7.0,
                ),
                // Inner road path
                Polyline(
                  points: _routePoints.isNotEmpty
                      ? _routePoints
                      : [startPoint, patientPoint],
                  color: const Color(0xFF0D7C6A),
                  strokeWidth: 4.5,
                ),
              ],
            ),

            // Markers
            MarkerLayer(
              markers: [
                // Provider Live GPS Marker
                Marker(
                  point: startPoint,
                  width: 50,
                  height: 50,
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D7C6A),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 8,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.navigation_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ),

                // Patient Home Marker
                Marker(
                  point: patientPoint,
                  width: 70,
                  height: 65,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.shade700,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: const [
                            BoxShadow(color: Colors.black12, blurRadius: 4),
                          ],
                        ),
                        child: Text(
                          widget.destinationName.split(' ').first,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        width: 36,
                        height: 36,
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
                        child: const Icon(
                          Icons.home_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),

        // ─── 2. Top Navigation Guidance Card ───────────────────────────────────
        Positioned(
          top: 14,
          left: 14,
          right: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _getTurnIcon(_currentInstruction ?? ''),
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'TURN-BY-TURN ROAD GUIDANCE',
                        style: TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 9,
                          letterSpacing: 0.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _currentInstruction ??
                            'Heading towards ${widget.destinationName}',
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

        // ─── 3. Badges: Exact Patient Location & Live GPS ─────────────────────
        Positioned(
          top: 76,
          left: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF10B981)),
              boxShadow: const [
                BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF059669)),
                SizedBox(width: 4),
                Text(
                  'Exact Destination',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 10.5,
                    color: Color(0xFF065F46),
                  ),
                ),
              ],
            ),
          ),
        ),

        Positioned(
          top: 76,
          right: 14,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [
                BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                const Text(
                  'LIVE GPS',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 10.5,
                    color: Color(0xFF1E293B),
                  ),
                ),
              ],
            ),
          ),
        ),

        // ─── 4. Quick Actions (Fit Bounds & Recenter) ──────────────────────────
        Positioned(
          bottom: widget.showArrivedButton ? 195 : 120,
          right: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FloatingActionButton.small(
                heroTag: 'live_tracking_fit_bounds',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0D7C6A),
                tooltip: 'Fit route on screen',
                onPressed: _fitBothMarkers,
                child: const Icon(Icons.fit_screen, size: 19),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'live_tracking_recenter',
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0D7C6A),
                tooltip: 'Re-center GPS',
                onPressed: _recenterOnGps,
                child: const Icon(Icons.my_location, size: 19),
              ),
            ],
          ),
        ),

        // ─── 5. Bottom HUD: ETA, Distance & Arrival Button ────────────────────
        Positioned(
          bottom: 16,
          left: 14,
          right: 14,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'APPROACHING ${widget.destinationName.toUpperCase()}',
                            style: const TextStyle(
                              color: Color(0xFF8A9AAA),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (widget.destinationAddress != null &&
                              widget.destinationAddress!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                widget.destinationAddress!,
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
                                '$_etaMinutes min',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 22,
                                  color: Color(0xFF0D7C6A),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '• ${_distanceKm.toStringAsFixed(1)} km',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                  color: Color(0xFF4A5A6A),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0FDF4),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF86EFAC)),
                                ),
                                child: const Text(
                                  'Road Route',
                                  style: TextStyle(
                                    color: Color(0xFF166534),
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (widget.showArrivedButton && widget.onArrived != null) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D7C6A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: widget.onArrived,
                      child: const Text(
                        'I Have Arrived at Patient Location',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
