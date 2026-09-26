import 'dart:async';
import 'dart:isolate';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

// ─── Foreground Task Handler (runs in a separate isolate on Android) ──────────
@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(_GpsTaskHandler());
}

class _GpsTaskHandler extends TaskHandler {
  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeatTimer;
  SendPort? _sendPort;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    _sendPort = FlutterForegroundTask.receivePort?.sendPort;
    await _startPositionStream();
    // Heartbeat every 10 s — re-polls GPS so stationary providers keep emitting
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      await _emitCurrentPosition();
    });
  }

  Future<void> _startPositionStream() async {
    _positionSub?.cancel();
    try {
      _positionSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 2, // emit only when moved ≥ 2 metres
        ),
      ).listen((Position pos) {
        _sendPort?.send({
          'lat': pos.latitude,
          'lng': pos.longitude,
          'accuracy': pos.accuracy,
          'timestamp': pos.timestamp.millisecondsSinceEpoch,
        });
      }, onError: (_) {});
    } catch (_) {}
  }

  Future<void> _emitCurrentPosition() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );
      _sendPort?.send({
        'lat': pos.latitude,
        'lng': pos.longitude,
        'accuracy': pos.accuracy,
        'timestamp': pos.timestamp.millisecondsSinceEpoch,
      });
    } catch (_) {}
  }

  @override
  Future<void> onRepeatEvent(DateTime timestamp) async {
    // Called by flutter_foreground_task on each repeat interval tick
    await _emitCurrentPosition();
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {
    _positionSub?.cancel();
    _heartbeatTimer?.cancel();
  }

  @override
  void onReceiveData(Object data) {}

  @override
  void onNotificationButtonPressed(String id) {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Manages the lifecycle of the Flutter foreground GPS service.
/// Call [BackgroundGpsService.start] when a provider goes online,
/// [BackgroundGpsService.stop] when they go offline or the session ends.
class BackgroundGpsService {
  static ReceivePort? _receivePort;

  /// Configure the foreground task options.
  /// Must be called once at app startup (in main()) before any provider goes online.
  static void configure() {
    // Skip on unsupported platforms
    if (kIsWeb) return;
    try {
      FlutterForegroundTask.init(
        androidNotificationOptions: AndroidNotificationOptions(
          channelId: 'merihcare_gps_service',
          channelName: 'Merihcare Live GPS',
          channelDescription:
              'Keeps your real-time GPS location active while you are on duty.',
          channelImportance: NotificationChannelImportance.LOW,
          priority: NotificationPriority.LOW,
          enableVibration: false,
          playSound: false,
          showWhen: false,
        ),
        iosNotificationOptions: const IOSNotificationOptions(
          showNotification: true,
          playSound: false,
        ),
        foregroundTaskOptions: ForegroundTaskOptions(
          eventAction: ForegroundTaskEventAction.repeat(15000), // every 15 seconds
          autoRunOnBoot: false,
          allowWakeLock: true,
          allowWifiLock: true,
        ),
      );
    } catch (_) {
      // Silently fail in test/desktop environments
    }
  }

  /// Start foreground GPS service.
  /// Returns true if the service started successfully.
  static Future<bool> start() async {
    if (kIsWeb) return false;
    try {
      // Request location permission
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) return false;

      // Request notification permission (Android 13+)
      final notifPerm = await FlutterForegroundTask.checkNotificationPermission();
      if (notifPerm != NotificationPermission.granted) {
        await FlutterForegroundTask.requestNotificationPermission();
      }

      // Attach receive port for data from the isolate
      _receivePort = FlutterForegroundTask.receivePort;

      // Start or restart the service
      ServiceRequestResult result;
      if (await FlutterForegroundTask.isRunningService) {
        result = await FlutterForegroundTask.restartService();
      } else {
        result = await FlutterForegroundTask.startService(
          notificationTitle: '📍 Merihcare — Live GPS Active',
          notificationText: 'Your location is being shared with patients on your route.',
          callback: startCallback,
        );
      }

      return result is ServiceRequestSuccess;
    } catch (_) {
      // Plugin unavailable in test/desktop environments — silently degrade
      return false;
    }
  }

  /// Stop the foreground GPS service.
  static Future<void> stop() async {
    _receivePort = null;
    try {
      await FlutterForegroundTask.stopService();
    } catch (_) {}
  }

  /// Update the persistent notification text (e.g., show appointment context or ETA).
  static Future<void> updateNotification({
    required String title,
    required String body,
  }) async {
    try {
      await FlutterForegroundTask.updateService(
        notificationTitle: title,
        notificationText: body,
      );
    } catch (_) {}
  }

  /// Stream of raw position maps emitted by the background isolate.
  /// Each map contains: lat, lng, accuracy, timestamp (milliseconds since epoch).
  static Stream<Map<String, dynamic>>? get positionStream {
    final port = _receivePort ?? FlutterForegroundTask.receivePort;
    return port?.asBroadcastStream().cast<Map<String, dynamic>>();
  }
}

/// Wraps a widget subtree so the OS can restart the foreground task after
/// the app is brought back to the foreground. Place at the root of your widget tree.
class WithForegroundTask extends StatelessWidget {
  final Widget child;
  const WithForegroundTask({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    // FlutterForegroundTask.withForegroundTask was removed in v8+.
    // The service handles lifecycle automatically via the service config.
    return child;
  }
}
