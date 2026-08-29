import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:merihcare/core/connectivity/offline_queue_service.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Offline Resilience & Sync Tests', () {
    test('Should queue operations when network is offline', () async {
      final queue = OfflineQueueService.instance;

      await queue.queueOperation('/appointments/apt-1/notes', 'POST', {
        'notes': 'Recorded in offline mode',
      });

      final pending = await queue.getQueue();
      expect(pending.isNotEmpty, isTrue);
      expect(pending.last.path, '/appointments/apt-1/notes');
      expect(pending.last.data['notes'], 'Recorded in offline mode');
    });

    test('Should clear queue when all operations are successfully synced', () async {
      final queue = OfflineQueueService.instance;

      await queue.queueOperation('/locations/sync', 'PUT', {'lat': 9.005, 'lng': 38.784});
      expect((await queue.getQueue()).length, greaterThan(0));

      await queue.clearQueue();
      expect((await queue.getQueue()).isEmpty, isTrue);
    });
  });
}
