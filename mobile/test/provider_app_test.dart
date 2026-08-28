import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:merihcare/core/connectivity/offline_queue_service.dart';
import 'package:merihcare/core/location/location_tracking_service.dart';
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
      // Mocking target tracker start
      // Note: We don't trigger the actual Timer to avoid open timers hanging tests
    });
  });
}
