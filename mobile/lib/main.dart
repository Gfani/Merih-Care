import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/notifications/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase — requires google-services.json / GoogleService-Info.plist.
  // In development without those files, this will be a no-op or will error only
  // when actually running on device/emulator with real Firebase project.
  try {
    await Firebase.initializeApp();
    await NotificationService.instance.initialize();
  } catch (_) {
    // Silently skip push-notification init in environments without Firebase config.
  }

  runApp(
    const ProviderScope(
      child: MerihcareApp(),
    ),
  );
}
