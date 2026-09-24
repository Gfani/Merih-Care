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
import 'location_service.dart';

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
    final previousId = _providerId;
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

    // If already actively tracking with the same provider ID and active stream, avoid tearing down subscriptions
    if (_isTracking && _positionSubscription != null && previousId == _providerId) {
      return true;
    }

    if (_isTracking) {
      _positionSubscription?.cancel();
      _gpsTimer?.cancel();
    }
    _isTracking = true;

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

      // Persist to backend database via REST
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
        if (_isTracking && _isOnline && _latestPosition != null) {
          emitLocation(_latestPosition!);
        }
      });
    }

    // Step 1: Immediate zero-latency fix from OS cache or known locationProvider state
    try {
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        _latestPosition = lastKnown;
        _lat = lastKnown.latitude;
        _lon = lastKnown.longitude;
        _locationStreamController.add(lastKnown);
        emitLocation(lastKnown);
      } else {
        // Check if locationProvider already detected a genuine location
        final knownLocation = _ref?.read(locationProvider).location;
        if (knownLocation != null) {
          final knownPos = Position(
            latitude: knownLocation.latitude,
            longitude: knownLocation.longitude,
            timestamp: DateTime.now(),
            accuracy: knownLocation.accuracy,
            altitude: 0.0,
            altitudeAccuracy: 0.0,
            heading: 0.0,
            headingAccuracy: 0.0,
            speed: 0.0,
            speedAccuracy: 0.0,
          );
          _latestPosition = knownPos;
          _lat = knownLocation.latitude;
          _lon = knownLocation.longitude;
          _locationStreamController.add(knownPos);
          emitLocation(knownPos);
        }
      }
    } catch (_) {}

    // Step 2: Acquire fresh hardware GPS asynchronously and establish stream
    () async {
      try {
        final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }
          if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
            Position? freshPos;
            try {
              // 1. Try high accuracy satellite GPS (up to 6s)
              freshPos = await Geolocator.getCurrentPosition(
                desiredAccuracy: LocationAccuracy.high,
                timeLimit: const Duration(seconds: 6),
              );
            } catch (_) {
              try {
                // 2. Fall back to medium accuracy (Wi-Fi / Cell tower fused location in 3s)
                freshPos = await Geolocator.getCurrentPosition(
                  desiredAccuracy: LocationAccuracy.medium,
                  timeLimit: const Duration(seconds: 4),
                );
              } catch (_) {
                freshPos = await Geolocator.getLastKnownPosition();
              }
            }

            if (freshPos != null && _isTracking && _isOnline) {
              _latestPosition = freshPos;
              _lat = freshPos.latitude;
              _lon = freshPos.longitude;
              _locationStreamController.add(freshPos);
              emitLocation(freshPos);
            }

            // Continuous stream emits whenever provider moves >= 2 meters
            const locationSettings = LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 2,
            );

            _positionSubscription?.cancel();
            _positionSubscription = Geolocator.getPositionStream(
              locationSettings: locationSettings,
            ).listen((Position position) {
              if (!_isTracking || !_isOnline) return;
              _latestPosition = position;
              _lat = position.latitude;
              _lon = position.longitude;
              _locationStreamController.add(position);
              emitLocation(position);
            }, onError: (_) {});
          }
        }
      } catch (_) {}
    }();

    // Step 3: Periodic timer actively polls hardware GPS so stationary providers continue emitting real GPS
    _gpsTimer?.cancel();
    _gpsTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!_isTracking || !_isOnline) return;

      Position? fresh;
      try {
        fresh = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 4),
        );
      } catch (_) {
        try {
          fresh = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 3),
          );
        } catch (_) {
          fresh = await Geolocator.getLastKnownPosition();
        }
      }

      if (fresh != null) {
        _latestPosition = fresh;
        _lat = fresh.latitude;
        _lon = fresh.longitude;
        _locationStreamController.add(fresh);
        emitLocation(fresh);
      } else if (_latestPosition != null) {
        // Re-emit latest confirmed coordinates to prevent admin map timeout
        _lastEmittedAt = DateTime.now();
        emitLocation(_latestPosition!);
      }
    });

    return true;
  }

  /// Manually emit direct coordinates (e.g. from "Update GPS" button or explicit address picker)
  Future<void> emitDirectCoordinates(
    double latitude,
    double longitude, {
    double accuracy = 5.0,
    String? status,
  }) async {
    _lat = latitude;
    _lon = longitude;
    final pos = Position(
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.now(),
      accuracy: accuracy,
      altitude: 0.0,
      altitudeAccuracy: 0.0,
      heading: 0.0,
      headingAccuracy: 0.0,
      speed: 0.0,
      speedAccuracy: 0.0,
    );
    _latestPosition = pos;
    _lastEmittedAt = DateTime.now();
    _locationStreamController.add(pos);

    final socketToUse = _socket ?? _realtimeService?.socket ?? await ensureSocket();
    final idToSend = _providerId ?? '';
    final payload = {
      if (idToSend.isNotEmpty) 'providerId': idToSend,
      'userId': idToSend,
      'role': 'provider',
      'lat': latitude,
      'lng': longitude,
      'latitude': latitude,
      'longitude': longitude,
      'accuracy': accuracy,
      'status': status ?? 'available',
      'isOnline': _isOnline,
    };

    if (socketToUse != null) {
      socketToUse.emit('location_update', payload);
      socketToUse.emit('provider_location_update', payload);
      socketToUse.emit('update_location', payload);
    }

    _realtimeService?.sendLocationUpdate(
      appointmentId: _appointmentId,
      latitude: latitude,
      longitude: longitude,
    );

    if (idToSend.isNotEmpty && _client != null) {
      try {
        await _client!.dio.put('/locations/$idToSend/move', data: {
          'latitude': latitude,
          'longitude': longitude,
          'accuracy': accuracy,
        });
      } catch (_) {}
    }
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
      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
      } catch (_) {
        try {
          pos = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 3),
          );
        } catch (_) {
          pos = await Geolocator.getLastKnownPosition();
        }
      }

      if (pos != null) {
        _latestPosition = pos;
        _lat = pos.latitude;
        _lon = pos.longitude;
        _lastEmittedAt = DateTime.now();
        _locationStreamController.add(pos);

        final socketToUse = _socket ?? _realtimeService?.socket;
        final idToSend = _providerId ?? '';
        if (socketToUse != null) {
          final payload = {
            if (idToSend.isNotEmpty) 'providerId': idToSend,
            'userId': idToSend,
            'role': 'provider',
            'lat': pos.latitude,
            'lng': pos.longitude,
            'latitude': pos.latitude,
            'longitude': pos.longitude,
            'accuracy': pos.accuracy,
            'status': 'available',
            'isOnline': _isOnline,
          };
          socketToUse.emit('location_update', payload);
          socketToUse.emit('provider_location_update', payload);
          socketToUse.emit('update_location', payload);
        }

        _realtimeService?.sendLocationUpdate(
          appointmentId: _appointmentId,
          latitude: pos.latitude,
          longitude: pos.longitude,
        );

        if (idToSend.isNotEmpty && _client != null) {
          try {
            await _client!.dio.put('/locations/$idToSend/move', data: {
              'latitude': pos.latitude,
              'longitude': pos.longitude,
              'accuracy': pos.accuracy,
            });
          } catch (_) {}
        }
      }
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
