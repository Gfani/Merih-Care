import 'dart:async';
import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';

/// Result from road routing query
class RoadRouteResult {
  final List<LatLng> points;
  final double distanceMeters;
  final double durationSeconds;
  final String? nextTurnInstruction;
  final List<String> turnSteps;
  final bool isFallback;

  double get distanceKm => distanceMeters / 1000.0;
  int get etaMinutes => (durationSeconds / 60.0).round().clamp(1, 999);

  const RoadRouteResult({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
    this.nextTurnInstruction,
    this.turnSteps = const [],
    this.isFallback = false,
  });
}

/// Free Road Routing Service using OpenStreetMap OSRM driving engine
class RoadRoutingService {
  static final RoadRoutingService instance = RoadRoutingService._();
  RoadRoutingService._();

  /// Static helper for fetching driving route
  static Future<RoadRouteResult> getRoute({
    required LatLng start,
    required LatLng destination,
    bool forceRefresh = false,
  }) {
    return instance.getDrivingRoute(
      start: start,
      destination: destination,
      forceRefresh: forceRefresh,
    );
  }

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 4),
    receiveTimeout: const Duration(seconds: 4),
    headers: {'User-Agent': 'MerihcareMobile/1.0'},
  ));

  LatLng? _lastStart;
  LatLng? _lastDest;
  RoadRouteResult? _cachedResult;
  DateTime? _lastFetchTime;

  /// Fetches the real road network shortest driving route between start and destination
  Future<RoadRouteResult> getDrivingRoute({
    required LatLng start,
    required LatLng destination,
    bool forceRefresh = false,
  }) async {
    // If start and destination are unchanged and fetched recently (< 8 seconds), use cached route
    if (!forceRefresh && _cachedResult != null && _lastStart != null && _lastDest != null && _lastFetchTime != null) {
      final elapsed = DateTime.now().difference(_lastFetchTime!).inSeconds;
      if (elapsed < 8) {
        final dStart = const Distance().as(LengthUnit.Meter, start, _lastStart!);
        final dDest = const Distance().as(LengthUnit.Meter, destination, _lastDest!);
        if (dStart < 20 && dDest < 20) {
          return _cachedResult!;
        }
      }
    }

    try {
      final url = 'https://router.project-osrm.org/route/v1/driving/'
          '${start.longitude},${start.latitude};'
          '${destination.longitude},${destination.latitude}'
          '?overview=full&geometries=geojson&steps=true';

      final response = await _dio.get(url);
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data is Map ? response.data : {};
        if (data['code'] == 'Ok' &&
            data['routes'] is List &&
            (data['routes'] as List).isNotEmpty) {
          final route = data['routes'][0];
          final geometry = route['geometry'];
          final coordinates = geometry != null ? geometry['coordinates'] as List? : null;

          if (coordinates != null && coordinates.isNotEmpty) {
            final List<LatLng> roadPoints = [];
            for (final c in coordinates) {
              if (c is List && c.length >= 2) {
                final lng = (c[0] as num).toDouble();
                final lat = (c[1] as num).toDouble();
                roadPoints.add(LatLng(lat, lng));
              }
            }

            final double distMeters = (route['distance'] as num?)?.toDouble() ?? 0.0;
            final double durSeconds = (route['duration'] as num?)?.toDouble() ?? 0.0;

            // Extract turn-by-turn guidance steps
            final List<String> steps = [];
            String? nextTurn;
            if (route['legs'] is List && (route['legs'] as List).isNotEmpty) {
              final leg = route['legs'][0];
              if (leg['steps'] is List) {
                for (final s in leg['steps']) {
                  final man = s['maneuver'];
                  final type = man?['type']?.toString() ?? '';
                  final modifier = man?['modifier']?.toString() ?? '';
                  final name = s['name']?.toString() ?? '';
                  if (type.isNotEmpty) {
                    final text = _formatManeuver(type, modifier, name);
                    if (text.isNotEmpty) steps.add(text);
                  }
                }
                if (steps.isNotEmpty) {
                  nextTurn = steps.first;
                }
              }
            }

            final result = RoadRouteResult(
              points: roadPoints,
              distanceMeters: distMeters,
              durationSeconds: durSeconds,
              nextTurnInstruction: nextTurn,
              turnSteps: steps,
              isFallback: false,
            );

            _lastStart = start;
            _lastDest = destination;
            _cachedResult = result;
            _lastFetchTime = DateTime.now();
            return result;
          }
        }
      }
    } catch (_) {
      // In offline or timeout scenario, fall back to calculated points
    }

    // Fallback: Generate direct line if OSRM is unreachable
    final straightDist = const Distance().as(LengthUnit.Meter, start, destination);
    return RoadRouteResult(
      points: [start, destination],
      distanceMeters: straightDist,
      durationSeconds: (straightDist / 1000.0) * 180.0,
      nextTurnInstruction: 'Proceed towards patient destination',
      isFallback: true,
    );
  }

  static String _formatManeuver(String type, String modifier, String name) {
    final street = (name.isNotEmpty && name != 'null') ? ' onto $name' : '';
    switch (type) {
      case 'turn':
        return 'Turn ${modifier.isNotEmpty ? modifier : 'ahead'}$street';
      case 'new name':
      case 'continue':
        return 'Continue straight$street';
      case 'depart':
        return 'Head ${modifier.isNotEmpty ? modifier : 'forward'}$street';
      case 'arrive':
        return 'Arriving at patient location';
      case 'roundabout':
      case 'rotary':
        return 'Take roundabout$street';
      case 'fork':
        return 'Keep ${modifier.isNotEmpty ? modifier : 'straight'} at fork$street';
      default:
        return '$type $modifier$street'.trim();
    }
  }
}
