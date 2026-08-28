import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';

class LocationTrackingService {
  Timer? _timer;
  double _lat = 9.033; // Default Addis Ababa coordinates
  double _lon = 38.74;
  bool _isTracking = false;

  LocationTrackingService();

  Future<bool> requestPermissions() async {
    // Simulated foreground and background permission grant flow.
    // In real app, call permission_handler package.
    await Future.delayed(const Duration(milliseconds: 300));
    return true;
  }

  void startTracking(String providerId, ApiClient client) {
    if (_isTracking) return;
    _isTracking = true;

    _timer = Timer.periodic(const Duration(seconds: 8), (timer) async {
      // Mock provider movement slowly wandering
      _lat += 0.0001;
      _lon += 0.0001;

      try {
        await client.dio.put('/locations/$providerId/move', data: {
          'latitude': _lat,
          'longitude': _lon,
          'accuracy': 15.0,
        });
      } catch (_) {
        // Safe fail — don't crash app on background location transmission drops
      }
    });
  }

  void stopTracking() {
    _timer?.cancel();
    _isTracking = false;
  }

  bool get isTracking => _isTracking;
}

final locationTrackingProvider = Provider<LocationTrackingService>((ref) {
  return LocationTrackingService();
});
