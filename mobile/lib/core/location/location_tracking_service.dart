import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../network/api_client.dart';
import '../network/realtime_service.dart';

/// Riverpod provider to observe and manage the provider's online/offline availability toggle
final providerOnlineStatusProvider = StateProvider<bool>((ref) => true);

class LocationTrackingService with WidgetsBindingObserver {
  final Ref? _ref;
  StreamSubscription<Position>? _positionSubscription;
  Timer? _gpsTimer;
  double _lat = 9.02497; // Addis Ababa center
  double _lon = 38.74689;
  bool _isTracking = false;
  bool _isOnline = true;
  DateTime? _lastEmittedAt;
  Position? _latestPosition;

  String? _providerId;
  ApiClient? _client;
  MobileRealtimeService? _realtimeService;
  String? _appointmentId;

  final _locationStreamController = StreamController<Position>.broadcast();
  Stream<Position> get locationStream => _locationStreamController.stream;

  LocationTrackingService([this._ref]) {
    try {
      WidgetsBinding.instance.addObserver(this);
    } catch (_) {}
    final ref = _ref;
    if (ref != null) {
      _isOnline = ref.read(providerOnlineStatusProvider);
      // Listen to Riverpod state management for provider online/offline toggle
      ref.listen<bool>(providerOnlineStatusProvider, (previous, next) {
        _isOnline = next;
        if (!next) {
          stopTracking();
        } else if (!_isTracking) {
          if (_client != null && _providerId != null) {
            startTracking(
              providerId: _providerId!,
              client: _client!,
              realtimeService: _realtimeService,
              appointmentId: _appointmentId,
            );
          }
        }
      });
    }
  }

  /// Request permissions: LocationPermission.always or LocationPermission.whileInUse
  Future<bool> requestPermissions() async {
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return false;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        return false;
      }
      return permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    } catch (_) {
      // In test or desktop environments where native geolocator is unavailable
      return true;
    }
  }

  /// Start tracking hardware GPS and streaming telemetry over Socket.io
  void startTracking({
    required String providerId,
    required ApiClient client,
    MobileRealtimeService? realtimeService,
    String? appointmentId,
  }) async {
    _providerId = providerId;
    _client = client;
    _realtimeService = realtimeService;
    _appointmentId = appointmentId;
    _isOnline = true;

    final ref = _ref;
    if (ref != null) {
      try {
        ref.read(providerOnlineStatusProvider.notifier).state = true;
      } catch (_) {}
    }

    if (_isTracking) return;
    _isTracking = true;

    // Helper to emit coordinates to Socket.io and persist to backend
    void emitLocation(Position position) {
      _lat = position.latitude;
      _lon = position.longitude;
      _latestPosition = position;

      // 1. Emit directly over Socket.io:
      // socket.emit('location_update', { lat: position.latitude, lng: position.longitude });
      final socket = _realtimeService?.socket;
      if (socket != null && socket.connected) {
        socket.emit('location_update', {
          'lat': position.latitude,
          'lng': position.longitude,
        });
      } else if (_realtimeService != null) {
        _realtimeService!.sendLocationUpdate(
          appointmentId: _appointmentId,
          latitude: position.latitude,
          longitude: position.longitude,
        );
      }

      // 2. Persist to backend database as background fallback
      if (_providerId != null && _providerId!.isNotEmpty && _client != null) {
        try {
          _client!.dio.put('/locations/$_providerId/move', data: {
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracy': position.accuracy,
          });
        } catch (_) {}
      }
    }

    // 1. Immediate initial GPS fix
    try {
      final initialPos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );
      _latestPosition = initialPos;
      _lastEmittedAt = DateTime.now();
      _locationStreamController.add(initialPos);
      emitLocation(initialPos);
    } catch (_) {
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null) {
          _latestPosition = lastKnown;
          _lastEmittedAt = DateTime.now();
          _locationStreamController.add(lastKnown);
          emitLocation(lastKnown);
        } else {
          final fallbackPos = Position(
            longitude: _lon,
            latitude: _lat,
            timestamp: DateTime.now(),
            accuracy: 10.0,
            altitude: 0.0,
            altitudeAccuracy: 0.0,
            heading: 0.0,
            headingAccuracy: 0.0,
            speed: 0.0,
            speedAccuracy: 0.0,
          );
          _lastEmittedAt = DateTime.now();
          emitLocation(fallbackPos);
        }
      } catch (_) {
        final fallbackPos = Position(
          longitude: _lon,
          latitude: _lat,
          timestamp: DateTime.now(),
          accuracy: 10.0,
          altitude: 0.0,
          altitudeAccuracy: 0.0,
          heading: 0.0,
          headingAccuracy: 0.0,
          speed: 0.0,
          speedAccuracy: 0.0,
        );
        _lastEmittedAt = DateTime.now();
        emitLocation(fallbackPos);
      }
    }

    // 2. Setup Geolocator position stream with LocationAccuracy.high and ~10m distanceFilter
    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
    );

    try {
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen((Position position) {
        if (!_isTracking || !_isOnline) return;
        _latestPosition = position;
        _locationStreamController.add(position);

        // Throttle GPS stream to emit over Socket.io exactly once every 10 seconds
        final now = DateTime.now();
        if (_lastEmittedAt == null ||
            now.difference(_lastEmittedAt!).inSeconds >= 10) {
          _lastEmittedAt = now;
          emitLocation(position);
        }
      }, onError: (_) {});
    } catch (_) {}

    // 3. Companion 10-second periodic timer ensures stationary providers still transmit
    // live heartbeats exactly every 10 seconds
    _gpsTimer?.cancel();
    _gpsTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isTracking || !_isOnline) return;

      final now = DateTime.now();
      if (_lastEmittedAt == null ||
          now.difference(_lastEmittedAt!).inSeconds >= 10) {
        Position? pos = _latestPosition;
        if (pos == null) {
          try {
            pos = await Geolocator.getCurrentPosition(
              desiredAccuracy: LocationAccuracy.high,
              timeLimit: const Duration(seconds: 4),
            );
            _latestPosition = pos;
          } catch (_) {
            pos = await Geolocator.getLastKnownPosition();
          }
        }
        if (pos != null) {
          _lastEmittedAt = now;
          _locationStreamController.add(pos);
          emitLocation(pos);
        }
      }
    });
  }

  /// Stop tracking: pause/cancel position stream and timer, and emit provider_offline
  void stopTracking({MobileRealtimeService? realtimeService}) {
    // 1. Immediately pause/cancel the getPositionStream and periodic timer
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _gpsTimer?.cancel();
    _gpsTimer = null;
    _isTracking = false;
    _isOnline = false;

    // 2. Explicitly emit offline event to backend before disconnecting socket:
    // socket.emit('provider_offline', {});
    final rt = realtimeService ?? _realtimeService;
    final socket = rt?.socket;
    if (socket != null) {
      socket.emit('provider_offline', <String, dynamic>{});
    }
    rt?.emitProviderOffline();

    final ref = _ref;
    if (ref != null) {
      try {
        ref.read(providerOnlineStatusProvider.notifier).state = false;
      } catch (_) {}
    }
  }

  /// App lifecycle handling for backgrounding & resumption
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Returned to foreground:
      // Verify WebSocket connection was not dropped by the OS
      _realtimeService?.ensureConnected();

      // If online and tracking, transmit an immediate fresh location fix
      if (_isTracking && _isOnline) {
        _refreshLocationNow();
      }
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // App entered background:
      // The OS location manager continues delivering updates via getPositionStream
      // Keep socket and stream alive while waiting for dispatch requests
    }
  }

  Future<void> _refreshLocationNow() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );
      _latestPosition = pos;
      _lastEmittedAt = DateTime.now();
      _locationStreamController.add(pos);

      final socket = _realtimeService?.socket;
      if (socket != null && socket.connected) {
        socket.emit('location_update', {
          'lat': pos.latitude,
          'lng': pos.longitude,
        });
      } else if (_realtimeService != null) {
        _realtimeService!.sendLocationUpdate(
          appointmentId: _appointmentId,
          latitude: pos.latitude,
          longitude: pos.longitude,
        );
      }
    } catch (_) {}
  }

  void dispose() {
    try {
      WidgetsBinding.instance.removeObserver(this);
    } catch (_) {}
    stopTracking();
    _locationStreamController.close();
  }

  bool get isTracking => _isTracking;
  bool get isOnline => _isOnline;
  double get currentLat => _lat;
  double get currentLon => _lon;
}

final locationTrackingProvider = Provider<LocationTrackingService>((ref) {
  final service = LocationTrackingService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});
