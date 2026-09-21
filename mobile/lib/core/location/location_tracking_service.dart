import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../network/api_client.dart';
import '../network/realtime_service.dart';

class LocationTrackingService {
  StreamSubscription<Position>? _positionSubscription;
  Timer? _gpsTimer;
  double _lat = 9.02497; // Addis Ababa center
  double _lon = 38.74689;
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
  }) async {
    if (_isTracking) return;
    _isTracking = true;

    // Helper to send coordinates to WebSocket and REST
    Future<void> sendCoords(double lat, double lng, double accuracy) async {
      _lat = lat;
      _lon = lng;

      // 1. Emit to WebSocket (sends both location_update and update_location)
      if (realtimeService != null) {
        realtimeService.sendLocationUpdate(
          appointmentId: appointmentId,
          latitude: lat,
          longitude: lng,
        );
      }

      // 2. Persist to backend REST database
      try {
        if (providerId.isNotEmpty) {
          await client.dio.put('/locations/$providerId/move', data: {
            'latitude': lat,
            'longitude': lng,
            'accuracy': accuracy,
          });
        }
      } catch (_) {}
    }

    // 1. Immediate initial GPS fix
    try {
      final initialPos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );
      _locationStreamController.add(initialPos);
      await sendCoords(initialPos.latitude, initialPos.longitude, initialPos.accuracy);
    } catch (_) {
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null) {
          _locationStreamController.add(lastKnown);
          await sendCoords(lastKnown.latitude, lastKnown.longitude, lastKnown.accuracy);
        } else {
          await sendCoords(_lat, _lon, 10.0);
        }
      } catch (_) {
        await sendCoords(_lat, _lon, 10.0);
      }
    }

    // 2. Hardware GPS Position Stream for continuous motion
    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
    );

    try {
      _positionSubscription =
          Geolocator.getPositionStream(locationSettings: locationSettings)
              .listen((Position position) {
        _locationStreamController.add(position);
        sendCoords(position.latitude, position.longitude, position.accuracy);
      }, onError: (_) {});
    } catch (_) {}

    // 3. Regular 10-second GPS interval (per requirements)
    // Ensures updates are consistently emitted to backend even when stationary
    _gpsTimer?.cancel();
    _gpsTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isTracking) return;
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 4),
        );
        _locationStreamController.add(pos);
        await sendCoords(pos.latitude, pos.longitude, pos.accuracy);
      } catch (_) {
        // Broadcast current known coords if query times out
        await sendCoords(_lat, _lon, 10.0);
      }
    });
  }

  void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _gpsTimer?.cancel();
    _gpsTimer = null;
    _isTracking = false;
  }

  bool get isTracking => _isTracking;
  double get currentLat => _lat;
  double get currentLon => _lon;
}

final locationTrackingProvider = Provider<LocationTrackingService>((ref) {
  return LocationTrackingService();
});
