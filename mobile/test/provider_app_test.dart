import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:merihcare/core/connectivity/offline_queue_service.dart';
import 'package:merihcare/core/location/location_tracking_service.dart';
import 'package:merihcare/core/location/location_service.dart';
import 'package:merihcare/features/provider_app/widgets/provider_incoming_requests_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

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
      expect(service.isOnline, true);
    });

    test('Should respond to providerOnlineStatusProvider changes', () {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);

      expect(container.read(providerOnlineStatusProvider), true);
      expect(service.isOnline, true);

      // Toggling offline should trigger stopTracking and mark offline
      container.read(providerOnlineStatusProvider.notifier).state = false;
      expect(service.isOnline, false);
      expect(service.isTracking, false);
    });

    test('Should reset tracking state and emit offline event on stopTracking', () {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);

      service.stopTracking();
      expect(service.isTracking, false);
      expect(service.isOnline, false);
      expect(container.read(providerOnlineStatusProvider), false);
    });

    test('Should execute startTracking and goOnline successfully', () async {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);
      final socket = io.io(
        'http://localhost:3000',
        io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().build(),
      );

      final started = await service.startTracking('prov-test-123', socket);
      expect(started, true);
      expect(service.isTracking, true);
      expect(service.isOnline, true);

      service.stopTracking();
      expect(service.isTracking, false);
      expect(service.isOnline, false);

      final wentOnline = await service.goOnline(providerId: 'prov-test-456', socket: socket);
      expect(wentOnline, true);
      expect(service.isTracking, true);
      expect(service.isOnline, true);

      service.stopTracking();
    });

    test('Should emit updated coordinates and move position when provider moves', () async {
      final container = ProviderContainer();
      final service = container.read(locationTrackingProvider);

      final positions = <Position>[];
      final sub = service.locationStream.listen(positions.add);

      await service.emitDirectCoordinates(9.0300, 38.7400);
      expect(service.latestPosition, isNotNull);
      expect(service.latestPosition!.latitude, 9.0300);
      expect(service.latestPosition!.longitude, 38.7400);

      // Simulate provider moving
      await service.emitDirectCoordinates(9.0350, 38.7450);
      expect(service.latestPosition!.latitude, 9.0350);
      expect(service.latestPosition!.longitude, 38.7450);
      expect(positions.length, 2);

      await sub.cancel();
      service.stopTracking();
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

  group('Provider Live Requests Map Tests', () {
    test('Should resolve explicit patient coordinates when provided', () {
      final req = {
        'id': 'req-101',
        'patientLat': 9.0123,
        'patientLng': 38.7654,
      };

      final loc = ProviderIncomingRequestsMap.resolveLocation(req);
      expect(loc.latitude, closeTo(9.0123, 0.0001));
      expect(loc.longitude, closeTo(38.7654, 0.0001));
    });

    test('Should resolve coordinates from nested location map', () {
      final req = {
        'id': 'req-102',
        'location': {
          'latitude': 9.0345,
          'longitude': 38.7512,
        },
      };

      final loc = ProviderIncomingRequestsMap.resolveLocation(req);
      expect(loc.latitude, closeTo(9.0345, 0.0001));
      expect(loc.longitude, closeTo(38.7512, 0.0001));
    });

    test('Should deterministically fallback to nearby offset when coordinates missing', () {
      final req = {
        'id': 'req-fallback-456',
        'patientName': 'Abebe Bikila',
      };

      final loc = ProviderIncomingRequestsMap.resolveLocation(
        req,
        providerLat: 9.0200,
        providerLon: 38.7500,
      );

      // Should be within ~1 to 5 km of provider
      expect(loc.latitude, isNot(9.0200));
      expect(loc.longitude, isNot(38.7500));
      expect((loc.latitude - 9.0200).abs(), lessThan(0.05));
      expect((loc.longitude - 38.7500).abs(), lessThan(0.05));
    });

    testWidgets('ProviderIncomingRequestsMap renders idle radar state when no requests', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProviderIncomingRequestsMap(
              incomingRequests: const [],
              providerLat: 9.02,
              providerLon: 38.75,
              onAccept: (_) {},
              onDecline: (_) {},
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Waiting for Patient Requests'), findsOneWidget);
      expect(find.textContaining('You are visible to nearby patients'), findsOneWidget);
    });

    testWidgets('ProviderIncomingRequestsMap renders patient pickup card and triggers actions', (tester) async {
      dynamic acceptedReq;
      dynamic declinedReq;

      final sampleReq = {
        'id': 'req-live-1',
        'patientName': 'Almaz Kebede',
        'service': 'Cardiac Care Visit',
        'location': 'Kazanchis, Addis Ababa',
        'price': 950,
        'patientLat': 9.0180,
        'patientLng': 38.7620,
      };

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProviderIncomingRequestsMap(
              incomingRequests: [sampleReq],
              providerLat: 9.0200,
              providerLon: 38.7500,
              onAccept: (req) => acceptedReq = req,
              onDecline: (req) => declinedReq = req,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Almaz Kebede'), findsWidgets);
      expect(find.text('Cardiac Care Visit'), findsOneWidget);
      expect(find.text('ETB 950'), findsOneWidget);
      expect(find.text('Accept Request'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);

      // Tap Accept
      await tester.tap(find.text('Accept Request'));
      await tester.pump();
      expect(acceptedReq, equals(sampleReq));

      // Tap Decline
      await tester.tap(find.text('Decline'));
      await tester.pump();
      expect(declinedReq, equals(sampleReq));
    });

    testWidgets('PatientLocationMiniPreview renders mini map preview and badge', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PatientLocationMiniPreview(
              patientPoint: LatLng(9.0150, 38.7600),
              providerPoint: LatLng(9.0200, 38.7500),
              patientName: 'Test Patient',
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Pickup Preview'), findsOneWidget);
    });
  });
}


