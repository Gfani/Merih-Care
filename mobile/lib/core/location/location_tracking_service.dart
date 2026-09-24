import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart';
import '../network/api_client.dart';
import '../network/io_client_base.dart';
import '../network/realtime_service.dart';
import '../storage/secure_storage.dart';
import '../../features/auth/auth_provider.dart';

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
  DateTime? get lastEmittedAt => _lastEmittedAt;
  Position? _latestPosition;

  String? _providerId;
  ApiClient? _client;
  MobileRealtimeService? _realtimeService;
  Socket? _socket;
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
          final s = _socket ?? _realtimeService?.socket;
          if (_providerId != null && s != null) {
            startTracking(
              _providerId!,
              s,
              client: _client,
              realtimeService: _realtimeService,
              appointmentId: _appointmentId,
            );
          }
        }
      });
    }
  }

  /// Request permissions using Geolocator.requestPermission()
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

  /// Initialize and connect Socket.IO client: http://<host>/realtime with JWT token
  Future<Socket?> ensureSocket({String? token, String? baseUrl}) async {
    if (_realtimeService?.socket != null && _realtimeService!.socket!.connected) {
      _socket = _realtimeService!.socket;
      return _socket;
    }
    if (_socket != null && _socket!.connected) {
      return _socket;
    }

    final authToken = token ??
        _realtimeService?.token ??
        await SecureStorage.instance.readToken() ??
        '';
    final url = baseUrl ?? defaultRealtimeUrl;

    _socket = io(
      '$url/realtime',
      OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': authToken})
          .enableReconnection()
          .setReconnectionAttempts(999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .build(),
    );

    _socket!.connect();
    return _socket;
  }

  /// Start tracking hardware GPS and streaming telemetry over Socket.io
  Future<bool> startTracking(
    String providerId,
    Socket socket, {
    ApiClient? client,
    MobileRealtimeService? realtimeService,
    String? appointmentId,
  }) async {
    String effectiveId = providerId;
    if (effectiveId.isEmpty && _ref != null) {
      try {
        final authUser = _ref.read(authProvider).user;
        effectiveId = authUser?['provider']?['id']?.toString() ??
            authUser?['providerId']?.toString() ??
            authUser?['id']?.toString() ??
            '';
      } catch (_) {}
    }
    _providerId = effectiveId.isNotEmpty ? effectiveId : _providerId;
    _socket = socket;
    if (client != null) _client = client;
    if (realtimeService != null) _realtimeService = realtimeService;
    if (appointmentId != null) _appointmentId = appointmentId;
    _isOnline = true;

    final ref = _ref;
    if (ref != null) {
      try {
        ref.read(providerOnlineStatusProvider.notifier).state = true;
      } catch (_) {}
    }

    if (_isTracking) {
      _positionSubscription?.cancel();
      _gpsTimer?.cancel();
    }
    _isTracking = true;

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

    // Helper to emit coordinates to Socket.io and backend
    void emitLocation(Position position) {
      _lat = position.latitude;
      _lon = position.longitude;
      _latestPosition = position;
      _lastEmittedAt = DateTime.now();
      final idToSend = _providerId ?? effectiveId;

      final payload = {
        if (idToSend.isNotEmpty) 'providerId': idToSend,
        'userId': idToSend,
        'role': 'provider',
        'lat': position.latitude,
        'lng': position.longitude,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'status': 'available',
        'isOnline': true,
      };

      socket.emit('location_update', payload);
      socket.emit('provider_location_update', payload);
      socket.emit('update_location', payload);

      _realtimeService?.sendLocationUpdate(
        appointmentId: _appointmentId,
        latitude: position.latitude,
        longitude: position.longitude,
      );

      // Persist fallback to backend database
      if (idToSend.isNotEmpty && _client != null) {
        () async {
          try {
            await _client!.dio.put('/locations/$idToSend/move', data: {
              'latitude': position.latitude,
              'longitude': position.longitude,
              'accuracy': position.accuracy,
            });
          } catch (_) {}
        }();
      }
    }

    // If socket is still connecting, ensure it immediately emits upon connection
    if (!socket.connected) {
      socket.once('connect', (_) {
        if (_isTracking && _isOnline) {
          emitLocation(_latestPosition ?? fallbackPos);
        }
      });
    }

    // Step 1: Immediate zero-latency fix (last known or fallback) so provider pops up on map instantly
    try {
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        _latestPosition = lastKnown;
        _locationStreamController.add(lastKnown);
        emitLocation(lastKnown);
      } else {
        _latestPosition = fallbackPos;
        _locationStreamController.add(fallbackPos);
        emitLocation(fallbackPos);
      }
    } catch (_) {
      _latestPosition = fallbackPos;
      _locationStreamController.add(fallbackPos);
      emitLocation(fallbackPos);
    }

    // Step 2: Request permissions & high-accuracy GPS asynchronously in background
    () async {
      try {
        final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }
          if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
            final freshPos = await Geolocator.getCurrentPosition(
              desiredAccuracy: LocationAccuracy.high,
              timeLimit: const Duration(seconds: 5),
            );
            if (_isTracking && _isOnline) {
              _latestPosition = freshPos;
              _locationStreamController.add(freshPos);
              emitLocation(freshPos);
            }
          }
        }
      } catch (_) {}
    }();

    // Start location stream: Geolocator.getPositionStream with LocationAccuracy.high and distanceFilter: 10
    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10, // Only emit when the provider moves 10 meters
    );

    try {
      _positionSubscription?.cancel();
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen((Position position) {
        if (!_isTracking || !_isOnline) return;
        _latestPosition = position;
        _locationStreamController.add(position);

        // Broadcast real coordinates to backend
        emitLocation(position);
      }, onError: (_) {});
    } catch (_) {}

    // Companion periodic timer ensures stationary providers continue emitting live GPS telemetry
    _gpsTimer?.cancel();
    _gpsTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isTracking || !_isOnline) return;

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
        _lastEmittedAt = DateTime.now();
        _locationStreamController.add(pos);
        emitLocation(pos);
      }
    });

    return true;
  }

  /// Convenience method when tapping "Go Online"
  Future<bool> goOnline({String? providerId, Socket? socket}) async {
    final pid = providerId ?? _providerId ?? '';
    final s = socket ?? _socket ?? await ensureSocket();
    if (s != null) {
      return startTracking(pid, s);
    }
    return false;
  }

  /// Stop tracking: pause/cancel position stream and timer, and emit provider_offline
  void stopTracking({MobileRealtimeService? realtimeService}) {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _gpsTimer?.cancel();
    _gpsTimer = null;
    _isTracking = false;
    _isOnline = false;

    final rt = realtimeService ?? _realtimeService;
    final socketToUse = _socket ?? rt?.socket;
    if (socketToUse != null) {
      socketToUse.emit('provider_offline', {
        if (_providerId != null && _providerId!.isNotEmpty) 'providerId': _providerId,
      });
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
      _realtimeService?.ensureConnected();

      if (_isTracking && _isOnline) {
        _refreshLocationNow();
      }
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

      final socketToUse = _socket ?? _realtimeService?.socket;
      if (socketToUse != null) {
        socketToUse.emit('location_update', {
          if (_providerId != null && _providerId!.isNotEmpty) 'providerId': _providerId,
          'lat': pos.latitude,
          'lng': pos.longitude,
        });
      }

      _realtimeService?.sendLocationUpdate(
        appointmentId: _appointmentId,
        latitude: pos.latitude,
        longitude: pos.longitude,
      );
    } catch (_) {}
  }

  void dispose() {
    try {
      WidgetsBinding.instance.removeObserver(this);
    } catch (_) {}
    stopTracking();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _locationStreamController.close();
  }

  bool get isTracking => _isTracking;
  bool get isOnline => _isOnline;
  double get currentLat => _lat;
  double get currentLon => _lon;
  Socket? get socket => _socket ?? _realtimeService?.socket;
}

final locationTrackingProvider = Provider<LocationTrackingService>((ref) {
  final service = LocationTrackingService(ref);
  ref.onDispose(() => service.dispose());
  return service;
});
