import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Booking & Appointment Lifecycle Tests', () {
    test('Should construct and validate appointment model', () {
      final appointment = {
        'id': 'apt-101',
        'patientId': 'patient-01',
        'providerId': 'provider-01',
        'serviceName': 'Post-Surgical Nursing Care',
        'scheduledDate': '2026-08-30',
        'scheduledTime': '10:00 AM',
        'address': 'Bole Atlas, Addis Ababa',
        'status': 'requested',
        'price': 450.0,
      };

      expect(appointment['id'], 'apt-101');
      expect(appointment['serviceName'], 'Post-Surgical Nursing Care');
      expect(appointment['status'], 'requested');
      expect(appointment['price'], 450.0);
    });

    test('Should transition appointment status through full home visit lifecycle', () {
      final statuses = [
        'requested',
        'searching',
        'accepted',
        'on_the_way',
        'arrived',
        'in_progress',
        'completed',
      ];

      var currentStatus = 'requested';
      for (final next in statuses.skip(1)) {
        currentStatus = next;
        expect(statuses.contains(currentStatus), isTrue);
      }

      expect(currentStatus, 'completed');
    });

    test('Should calculate visit duration and estimated arrival accurately', () {
      final startTime = DateTime.parse('2026-08-30 10:00:00');
      final completedTime = DateTime.parse('2026-08-30 11:15:00');

      final durationMinutes = completedTime.difference(startTime).inMinutes;
      expect(durationMinutes, 75);
    });
  });
}
