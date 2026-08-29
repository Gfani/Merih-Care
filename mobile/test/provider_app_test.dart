import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:merihcare/core/connectivity/offline_queue_service.dart';
import 'package:merihcare/core/location/location_tracking_service.dart';
import 'package:merihcare/core/location/location_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  setUp(() {
    // Avoid secure storage native calls in unit test runner
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Offline Queue Service Tests', () {
    test('Should queue and retrieve operations correctly', () async {
      final queue = OfflineQueueService.instance;
      
      // Initially empty
      final initialList = await queue.getQueue();
      expect(initialList.isEmpty, true);

      // Queue an action
      await queue.queueOperation('/appointments/apt-1/status', 'PUT', {'status': 'arrived'});
      
      // Check queue has it
      final list = await queue.getQueue();
      expect(list.length, 1);
      expect(list[0].path, '/appointments/apt-1/status');
      expect(list[0].method, 'PUT');
      expect(list[0].data['status'], 'arrived');
    });
  });

  group('Location Tracking Service Tests', () {
    test('Should request mock permission successfully', () async {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);

      final granted = await service.requestPermissions();
      expect(granted, true);
    });

    test('Should toggle tracking state flags correctly', () {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);

      expect(service.isTracking, false);
    });
  });

  group('Location Service Tests', () {
    test('Should have default initial location', () {
      final container = ProviderContainer();
      final state = container.read(locationProvider);

      expect(state.location, isNotNull);
      expect(state.location!.subCity, 'Bole');
      expect(state.location!.city, 'Addis Ababa');
      expect(state.location!.latitude, closeTo(9.0054, 0.01));
      expect(state.location!.longitude, closeTo(38.7845, 0.01));
    });

    test('Should auto-detect and resolve GPS location successfully', () async {
      final container = ProviderContainer();
      final notifier = container.read(locationProvider.notifier);

      final detected = await notifier.autoDetectCurrentLocation();
      expect(detected, isNotNull);
      expect(detected!.latitude, isNotNull);
      expect(detected.longitude, isNotNull);
      expect(detected.address, isNotEmpty);
      expect(detected.city, 'Addis Ababa');

      final updatedState = container.read(locationProvider);
      expect(updatedState.isDetecting, false);
      expect(updatedState.location, equals(detected));
    });

    test('Should update custom location correctly', () {
      final container = ProviderContainer();
      final notifier = container.read(locationProvider.notifier);

      notifier.setCustomLocation('Sarbet Karl Square, Addis Ababa', 8.9950, 38.7380, 'Sarbet');
      final state = container.read(locationProvider);

      expect(state.location!.subCity, 'Sarbet');
      expect(state.location!.latitude, 8.9950);
      expect(state.location!.longitude, 38.7380);
      expect(state.location!.fullAddress, 'Sarbet Karl Square, Addis Ababa');
    });
  });
}
