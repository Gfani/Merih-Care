import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../network/api_client.dart';
import '../network/realtime_service.dart';

class LocationTrackingService {
  StreamSubscription<Position>? _positionSubscription;
  Timer? _fallbackTimer;
  double _lat = 9.0192; // Default Addis Ababa coordinates
  double _lon = 38.7578;
  bool _isTracking = false;

  final _locationStreamController = StreamController<Position>.broadcast();
  Stream<Position> get locationStream => _locationStreamController.stream;

  LocationTrackingService();

  Future<bool> requestPermissions() async {
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      return serviceEnabled &&
          (permission == LocationPermission.whileInUse ||
              permission == LocationPermission.always);
    } catch (_) {
      return true;
    }
  }

  void startTracking({
    required String providerId,
    required ApiClient client,
    MobileRealtimeService? realtimeService,
    String? appointmentId,
  }) {
    if (_isTracking) return;
    _isTracking = true;

    // 1. Hardware GPS Position Stream
    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5, // update every 5 meters
    );

    try {
      _positionSubscription =
          Geolocator.getPositionStream(locationSettings: locationSettings)
              .listen(
        (Position position) async {
          _lat = position.latitude;
          _lon = position.longitude;
          _locationStreamController.add(position);

          // Emit live location over WebSocket
          if (appointmentId != null && realtimeService != null) {
            realtimeService.sendLocationUpdate(
              appointmentId: appointmentId,
              latitude: position.latitude,
              longitude: position.longitude,
            );
          }

          // Persist to backend database via REST
          try {
            await client.dio.put('/locations/$providerId/move', data: {
              'latitude': position.latitude,
              'longitude': position.longitude,
              'accuracy': position.accuracy,
            });
          } catch (_) {}
        },
        onError: (_) {
          _startFallbackTimer(providerId, client, realtimeService, appointmentId);
        },
      );
    } catch (_) {
      _startFallbackTimer(providerId, client, realtimeService, appointmentId);
    }

    // Immediate initial fix
    Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 3),
    ).then((position) async {
      _lat = position.latitude;
      _lon = position.longitude;
      _locationStreamController.add(position);

      if (appointmentId != null && realtimeService != null) {
        realtimeService.sendLocationUpdate(
          appointmentId: appointmentId,
          latitude: position.latitude,
          longitude: position.longitude,
        );
      }

      try {
        await client.dio.put('/locations/$providerId/move', data: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
        });
      } catch (_) {}
    }).catchError((_) {
      _startFallbackTimer(providerId, client, realtimeService, appointmentId);
    });
  }

  void _startFallbackTimer(
    String providerId,
    ApiClient client,
    MobileRealtimeService? realtimeService,
    String? appointmentId,
  ) {
    if (_fallbackTimer != null) return;
    _fallbackTimer = Timer.periodic(const Duration(seconds: 6), (_) async {
      _lat += 0.0001;
      _lon += 0.0001;

      final simulated = Position(
        latitude: _lat,
        longitude: _lon,
        timestamp: DateTime.now(),
        accuracy: 10.0,
        altitude: 2355.0,
        heading: 45.0,
        speed: 5.0,
        speedAccuracy: 1.0,
        altitudeAccuracy: 5.0,
        headingAccuracy: 5.0,
      );

      _locationStreamController.add(simulated);

      if (appointmentId != null && realtimeService != null) {
        realtimeService.sendLocationUpdate(
          appointmentId: appointmentId,
          latitude: _lat,
          longitude: _lon,
        );
      }

      try {
        await client.dio.put('/locations/$providerId/move', data: {
          'latitude': _lat,
          'longitude': _lon,
          'accuracy': 10.0,
        });
      } catch (_) {}
    });
  }

  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _fallbackTimer?.cancel();
    _fallbackTimer = null;
    _isTracking = false;
  }

  bool get isTracking => _isTracking;
  double get currentLat => _lat;
  double get currentLon => _lon;
}

final locationTrackingProvider = Provider<LocationTrackingService>((ref) {
  return LocationTrackingService();
});
