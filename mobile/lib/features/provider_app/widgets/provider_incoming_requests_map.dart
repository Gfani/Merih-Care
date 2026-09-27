import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/location/road_routing_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/create_design_widgets.dart';
import '../../../shared/widgets/custom_map_markers.dart';

/// Interactive live map for providers displaying nearby patient requests
/// with pickup pins, route preview, and a floating Accept/Decline action banner.
class ProviderIncomingRequestsMap extends StatefulWidget {
  final List<dynamic> incomingRequests;
  final double providerLat;
  final double providerLon;
  final Function(dynamic req) onAccept;
  final Function(dynamic req) onDecline;
  final Function(dynamic req)? onSelect;
  final double height;

  const ProviderIncomingRequestsMap({
    super.key,
    required this.incomingRequests,
    required this.providerLat,
    required this.providerLon,
    required this.onAccept,
    required this.onDecline,
    this.onSelect,
    this.height = 390.0,
  });

  static double? toDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  /// Resolves or deterministically calculates the patient's coordinates
  static LatLng resolveLocation(
    dynamic req, {
    double providerLat = 9.02497,
    double providerLon = 38.74689,
  }) {
    if (req == null) return LatLng(providerLat, providerLon);

    double? lat = toDouble(req['patientLat']) ??
        toDouble(req['latitude']) ??
        toDouble(req['lat']);
    double? lng = toDouble(req['patientLng']) ??
        toDouble(req['longitude']) ??
        toDouble(req['lng']);

    if ((lat == null || lng == null) && req['location'] is Map) {
      final loc = req['location'] as Map;
      lat = toDouble(loc['latitude']) ?? toDouble(loc['lat']) ?? lat;
      lng = toDouble(loc['longitude']) ?? toDouble(loc['lng']) ?? lng;
    }

    if (lat != null && lng != null && lat != 0.0 && lng != 0.0) {
      return LatLng(lat, lng);
    }

    // Fallback: Deterministic realistic offset from the provider's GPS (1.2km to 3.2km away)
    final idStr = req['id']?.toString() ??
        req['appointmentId']?.toString() ??
        'req-default';
    final hash = idStr.hashCode.abs();
    final angle = (hash % 360) * pi / 180.0;
    final distKm = 1.2 + ((hash % 20) / 10.0); // 1.2 to 3.2 km
    final dLat = (distKm / 111.0) * sin(angle);
    final dLng =
        (distKm / (111.0 * cos(providerLat * pi / 180.0))) * cos(angle);

    return LatLng(providerLat + dLat, providerLon + dLng);
  }

  @override
  State<ProviderIncomingRequestsMap> createState() =>
      _ProviderIncomingRequestsMapState();
}

class _ProviderIncomingRequestsMapState
    extends State<ProviderIncomingRequestsMap> {
  final MapController _mapController = MapController();
  final Distance _distanceCalculator = const Distance();

  int _selectedRequestIndex = 0;
  List<LatLng> _roadRoutePoints = [];
  double? _roadDistanceKm;
  int? _roadEtaMinutes;

  LatLng _resolvePatientLocation(dynamic req) =>
      ProviderIncomingRequestsMap.resolveLocation(
        req,
        providerLat: widget.providerLat,
        providerLon: widget.providerLon,
      );

  @override
  void didUpdateWidget(covariant ProviderIncomingRequestsMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.incomingRequests.isNotEmpty) {
      if (_selectedRequestIndex >= widget.incomingRequests.length) {
        _selectedRequestIndex = 0;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _fitProviderAndSelected();
        _fetchRoadRoute();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fitProviderAndSelected();
      _fetchRoadRoute();
    });
  }

  Future<void> _fetchRoadRoute() async {
    if (widget.incomingRequests.isEmpty) return;
    final selectedReq = widget.incomingRequests[
        _selectedRequestIndex.clamp(0, widget.incomingRequests.length - 1)];
    final patientPoint = _resolvePatientLocation(selectedReq);
    final providerPoint = LatLng(widget.providerLat, widget.providerLon);
    try {
      final res = await RoadRoutingService.getRoute(
        start: providerPoint,
        destination: patientPoint,
      );
      if (mounted) {
        setState(() {
          _roadRoutePoints = res.points;
          _roadDistanceKm = res.distanceKm;
          _roadEtaMinutes = res.etaMinutes;
        });
      }
    } catch (_) {}
  }

  void _fitProviderAndSelected() {
    if (!mounted) return;
    try {
      final providerPoint = LatLng(widget.providerLat, widget.providerLon);
      if (widget.incomingRequests.isEmpty) {
        _mapController.move(providerPoint, 15.0);
        return;
      }

      final selectedReq = widget.incomingRequests[_selectedRequestIndex];
      final patientPoint = _resolvePatientLocation(selectedReq);

      final bounds = LatLngBounds(providerPoint, patientPoint);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.only(top: 50, left: 50, right: 50, bottom: 170),
        ),
      );
    } catch (_) {}
  }

  void _recenterOnProvider() {
    try {
      _mapController.move(
        LatLng(widget.providerLat, widget.providerLon),
        15.5,
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final hasRequests = widget.incomingRequests.isNotEmpty;
    final dynamic selectedReq = hasRequests
        ? widget.incomingRequests[_selectedRequestIndex.clamp(0, widget.incomingRequests.length - 1)]
        : null;

    final providerPoint = LatLng(widget.providerLat, widget.providerLon);
    final patientPoint = selectedReq != null
        ? _resolvePatientLocation(selectedReq)
        : null;

    // Distance & ETA calculation for selected request
    double distanceKm = _roadDistanceKm ?? 2.4;
    int etaMinutes = _roadEtaMinutes ?? 8;
    LatLng? midPoint;
    if (patientPoint != null) {
      if (_roadDistanceKm == null) {
        final double meters = _distanceCalculator.as(
          LengthUnit.Meter,
          providerPoint,
          patientPoint,
        );
        distanceKm = meters / 1000.0;
        etaMinutes = max(1, (distanceKm * 3.0).round());
      }
      if (_roadRoutePoints.length > 2) {
        midPoint = _roadRoutePoints[_roadRoutePoints.length ~/ 2];
      } else {
        midPoint = LatLng(
          (providerPoint.latitude + patientPoint.latitude) / 2,
          (providerPoint.longitude + patientPoint.longitude) / 2,
        );
      }
    }

    return Container(
      height: widget.height,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // ─── Real FlutterMap Canvas ──────────────────────────────────────────
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: providerPoint,
              initialZoom: 14.5,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.merihcare.mobile',
              ),

              // Route line connecting provider to selected request along real roads
              if (patientPoint != null)
                PolylineLayer(
                  polylines: [
                    if (_roadRoutePoints.isNotEmpty)
                      Polyline(
                        points: _roadRoutePoints,
                        color: const Color(0xFF042F2E).withOpacity(0.35),
                        strokeWidth: 6.5,
                      ),
                    Polyline(
                      points: _roadRoutePoints.isNotEmpty
                          ? _roadRoutePoints
                          : [providerPoint, patientPoint],
                      color: const Color(0xFF0D7C6A),
                      strokeWidth: 4.0,
                    ),
                  ],
                ),

              // Markers Layer
              MarkerLayer(
                markers: [
                  // 1. Provider Marker (You - Online Live GPS)
                  Marker(
                    point: providerPoint,
                    width: 80,
                    height: 85,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F766E),
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: const [
                              BoxShadow(color: Colors.black26, blurRadius: 4),
                            ],
                          ),
                          child: const Text(
                            'You',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(height: 2),
                        const ClinicianMapMarker(
                          isSelected: true,
                          isEnRoute: true,
                        ),
                      ],
                    ),
                  ),

                  // 2. Incoming Patient Pickup Markers
                  if (hasRequests)
                    ...widget.incomingRequests.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final req = entry.value;
                      final point = _resolvePatientLocation(req);
                      final isSelected = idx == _selectedRequestIndex;
                      final pName = req['patientName'] ??
                          (req['patient'] is Map
                              ? req['patient']['name']
                              : null) ??
                          'Patient';

                      return Marker(
                        point: point,
                        width: 100,
                        height: 80,
                        child: GestureDetector(
                          onTap: () {
                            setState(() => _selectedRequestIndex = idx);
                            if (widget.onSelect != null) {
                              widget.onSelect!(req);
                            }
                            _fitProviderAndSelected();
                            _fetchRoadRoute();
                          },
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Floating Patient Name badge
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? const Color(0xFFDC2626)
                                      : const Color(0xFF475569),
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Colors.black26,
                                        blurRadius: 4,
                                        offset: Offset(0, 2)),
                                  ],
                                ),
                                child: Text(
                                  pName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              // Custom Animated Pickup Pin
                              _PatientPickupPin(
                                isSelected: isSelected,
                              ),
                            ],
                          ),
                        ),
                      );
                    }),

                  // 3. Midpoint ETA badge along the route
                  if (midPoint != null)
                    Marker(
                      point: midPoint,
                      width: 180,
                      height: 42,
                      child: FloatingEtaBadge(
                        etaText: '~$etaMinutes min',
                        distanceText: '${distanceKm.toStringAsFixed(1)} km',
                      ),
                    ),
                ],
              ),
            ],
          ),

          // ─── Floating Top Controls Overlay ──────────────────────────────────
          Positioned(
            top: 12,
            right: 12,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Recenter GPS Button
                _MapControlButton(
                  icon: Icons.my_location_rounded,
                  tooltip: 'Recenter on You',
                  onTap: _recenterOnProvider,
                ),
                const SizedBox(height: 8),
                // Fit bounds button (if patient exists)
                if (hasRequests)
                  _MapControlButton(
                    icon: Icons.fit_screen_rounded,
                    tooltip: 'Fit Both on Screen',
                    onTap: _fitProviderAndSelected,
                  ),
              ],
            ),
          ),

          // ─── Live Dispatch Header Badge ─────────────────────────────────────
          Positioned(
            top: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.95),
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: hasRequests
                          ? const Color(0xFFDC2626)
                          : const Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    hasRequests
                        ? '${widget.incomingRequests.length} Care Request${widget.incomingRequests.length > 1 ? 's' : ''} Nearby'
                        : 'Radar Active • Searching Requests',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: hasRequests
                          ? const Color(0xFF991B1B)
                          : const Color(0xFF065F46),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ─── Bottom Floating Action Banner ──────────────────────────────────
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: selectedReq != null
                ? _buildRequestActionBanner(
                    selectedReq,
                    distanceKm,
                    etaMinutes,
                  )
                : _buildIdleRadarBanner(),
          ),
        ],
      ),
    );
  }

  /// Floating Action Card with Patient Details, Distance, and Accept/Decline Actions
  Widget _buildRequestActionBanner(
    dynamic req,
    double distanceKm,
    int etaMinutes,
  ) {
    final patientName = req['patientName'] ??
        (req['patient'] is Map ? req['patient']['name'] : null) ??
        'Patient';
    final service = req['service'] ??
        req['serviceType'] ??
        'Home Medical Visit';
    final address = req['location'] ?? req['address'] ?? 'Addis Ababa';
    final fee = req['price'] ?? req['amount'] ?? req['fee'] ?? 800;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pagination Indicator if multiple incoming requests exist
          if (widget.incomingRequests.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Request ${_selectedRequestIndex + 1} of ${widget.incomingRequests.length}',
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  Row(
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedRequestIndex = (_selectedRequestIndex -
                                    1 +
                                    widget.incomingRequests.length) %
                                widget.incomingRequests.length;
                          });
                          _fitProviderAndSelected();
                        },
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 4),
                          child: Icon(Icons.arrow_back_ios_new,
                              size: 13, color: AppTheme.primaryColor),
                        ),
                      ),
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedRequestIndex =
                                (_selectedRequestIndex + 1) %
                                    widget.incomingRequests.length;
                          });
                          _fitProviderAndSelected();
                        },
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 4),
                          child: Icon(Icons.arrow_forward_ios,
                              size: 13, color: AppTheme.primaryColor),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

          // Header Row: Avatar, Name, Service Badge, and Fee
          Row(
            children: [
              AvatarWidget(name: patientName, radius: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            patientName,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13.5,
                              color: AppTheme.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.verified,
                            color: Color(0xFF0D7C6A), size: 14),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      service,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0D7C6A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'ETB $fee',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0D7C6A),
                    ),
                  ),
                  const Text(
                    'Gross Fee',
                    style: TextStyle(
                      fontSize: 9.5,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Location and Distance/ETA Row
          Row(
            children: [
              const Icon(Icons.near_me_rounded,
                  size: 13, color: Color(0xFF0D7C6A)),
              const SizedBox(width: 4),
              Text(
                '${distanceKm.toStringAsFixed(1)} km away • ~$etaMinutes min drive',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSecondary,
                ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  address,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Action Buttons: Decline and Accept
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  onPressed: () => widget.onDecline(req),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Decline'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFFCA5A5)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 3,
                child: ElevatedButton.icon(
                  onPressed: () => widget.onAccept(req),
                  icon: const Icon(Icons.check_circle_outline_rounded,
                      size: 16),
                  label: const Text(
                    'Accept Request',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D7C6A),
                    foregroundColor: Colors.white,
                    elevation: 2,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Banner displayed when online and waiting for patient requests
  Widget _buildIdleRadarBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Row(
        children: [
          Icon(Icons.radar_rounded, color: Color(0xFF0D7C6A), size: 22),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Waiting for Patient Requests',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                Text(
                  'You are visible to nearby patients across Addis Ababa.',
                  style: TextStyle(
                    fontSize: 10.5,
                    color: AppTheme.textMuted,
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

/// Circular Map Control Button (e.g. Recenter, Fit Bounds)
class _MapControlButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _MapControlButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Icon(
              icon,
              size: 20,
              color: const Color(0xFF0F766E),
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom Animated Patient Pickup Pin for the map
class _PatientPickupPin extends StatelessWidget {
  final bool isSelected;

  const _PatientPickupPin({this.isSelected = false});

  @override
  Widget build(BuildContext context) {
    final pinColor = isSelected ? const Color(0xFFDC2626) : const Color(0xFFEA580C);

    return Stack(
      alignment: Alignment.center,
      children: [
        if (isSelected)
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: pinColor.withValues(alpha: 0.25),
            ),
          ),
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: pinColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Colors.black38,
                blurRadius: 6,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.health_and_safety_rounded,
              color: Colors.white,
              size: 16,
            ),
          ),
        ),
      ],
    );
  }
}

/// Mini map preview for high-priority service offers or compact dialogs
class PatientLocationMiniPreview extends StatelessWidget {
  final LatLng patientPoint;
  final LatLng providerPoint;
  final String? patientName;
  final double height;

  const PatientLocationMiniPreview({
    super.key,
    required this.patientPoint,
    required this.providerPoint,
    this.patientName,
    this.height = 135.0,
  });

  @override
  Widget build(BuildContext context) {
    final bounds = LatLngBounds(providerPoint, patientPoint);

    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: LatLng(
                (providerPoint.latitude + patientPoint.latitude) / 2,
                (providerPoint.longitude + patientPoint.longitude) / 2,
              ),
              initialZoom: 13.5,
              initialCameraFit: CameraFit.bounds(
                bounds: bounds,
                padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 24),
              ),
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.merihcare.mobile',
              ),
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: [providerPoint, patientPoint],
                    color: const Color(0xFF0D7C6A),
                    strokeWidth: 3.5,
                  ),
                ],
              ),
              MarkerLayer(
                markers: [
                  // Provider Marker
                  Marker(
                    point: providerPoint,
                    width: 26,
                    height: 26,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F766E),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: const [
                          BoxShadow(color: Colors.black26, blurRadius: 4),
                        ],
                      ),
                      child: const Center(
                        child: Icon(Icons.person, color: Colors.white, size: 13),
                      ),
                    ),
                  ),
                  // Patient Destination Pin
                  Marker(
                    point: patientPoint,
                    width: 30,
                    height: 30,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: const [
                          BoxShadow(color: Colors.black38, blurRadius: 5),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.location_on_rounded,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(10),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 4),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.map_rounded, size: 11, color: Color(0xFF0D7C6A)),
                  SizedBox(width: 4),
                  Text(
                    'Pickup Preview',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0D7C6A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

