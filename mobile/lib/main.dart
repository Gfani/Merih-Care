import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/notifications/notification_service.dart';
import 'core/location/background_gps_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Configure background GPS foreground service (must be called before any provider goes online)
  BackgroundGpsService.configure();

  // Render the Flutter UI immediately so cold launch is instantaneous
  runApp(
    const ProviderScope(
      child: MerihcareApp(),
    ),
  );

  // Initialize Firebase and push notifications asynchronously without delaying first frame
  _initServicesAsync();
}

Future<void> _initServicesAsync() async {
  try {
    await Firebase.initializeApp();
    await NotificationService.instance.initialize();
  } catch (_) {
    // Silently skip push-notification init in environments without Firebase config.
  }
}
