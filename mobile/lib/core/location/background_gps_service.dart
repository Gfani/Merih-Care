import 'dart:async';
import 'dart:isolate';
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';

// ─── Foreground Task Handler (runs in separate isolate on Android) ─────────────
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
    // Heartbeat every 10s so OS knows the task is alive
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      await _emitCurrentPosition();
    });
  }

  Future<void> _startPositionStream() async {
    _positionSub?.cancel();
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
    // flutter_foreground_task calls this on every interval tick
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
/// [BackgroundGpsService.stop] when they go offline.
class BackgroundGpsService {
  static ReceivePort? _receivePort;

  /// Configure the foreground task options (call once at app startup).
  static void configure() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'merihcare_gps_service',
        channelName: 'Merihcare Live GPS',
        channelDescription:
            'Keeps your real-time GPS location active while you are on duty so patients can track your arrival.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
        ),
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(
          const Duration(seconds: 15),
        ),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  /// Start foreground service. Returns the ReceivePort that emits position maps.
  /// The caller should listen to [onPosition] after calling this.
  static Future<bool> start() async {
    // Request location permissions first
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) return false;

    // Request notification permission for the persistent notification
    final notifPerm = await FlutterForegroundTask.checkNotificationPermission();
    if (notifPerm != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    // Setup receive port for data from the isolate
    _receivePort = FlutterForegroundTask.receivePort;

    final ServiceRequestResult result;
    if (await FlutterForegroundTask.isRunningService) {
      result = await FlutterForegroundTask.restartService();
    } else {
      result = await FlutterForegroundTask.startService(
        serviceId: 1001,
        notificationTitle: '📍 Merihcare — Live GPS Active',
        notificationText: 'Your location is being shared with patients on your route.',
        callback: startCallback,
      );
    }

    return result is ServiceRequestSuccess;
  }

  /// Stop the foreground GPS service.
  static Future<void> stop() async {
    _receivePort = null;
    await FlutterForegroundTask.stopService();
  }

  /// Update the persistent notification text (e.g. show ETA or appointment ID).
  static Future<void> updateNotification({
    required String title,
    required String body,
  }) async {
    await FlutterForegroundTask.updateService(
      notificationTitle: title,
      notificationText: body,
    );
  }

  /// Stream of raw position maps from the background isolate.
  /// Each map has keys: lat, lng, accuracy, timestamp.
  static Stream<Map<String, dynamic>>? get positionStream {
    final port = _receivePort ?? FlutterForegroundTask.receivePort;
    return port?.asBroadcastStream().cast<Map<String, dynamic>>();
  }

  static bool get isRunning =>
      FlutterForegroundTask.isRunningService as bool? ?? false;
}

/// Widget wrapper that ensures the WillStartForegroundTask callback is registered.
/// Wrap your MaterialApp or top-level Scaffold with this to support foreground tasks.
class WithForegroundTask extends StatelessWidget {
  final Widget child;
  const WithForegroundTask({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return FlutterForegroundTask.withForegroundTask(child: child);
  }
}
