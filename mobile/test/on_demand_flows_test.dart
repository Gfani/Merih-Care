import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:merihcare/features/patient/on_demand_flow_screen.dart';
import 'package:merihcare/features/provider_app/provider_active_flow_screen.dart';

void main() {
  group('On-Demand & Provider Active Flows Test', () {
    testWidgets('Patient OnDemandFlowScreen renders initial service select step', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: OnDemandFlowScreen(),
          ),
        ),
      );

      expect(find.text('Select Care Service'), findsOneWidget);
      expect(find.text('Doctor Home Visit'), findsOneWidget);
      expect(find.text('Urgent Nursing Care'), findsOneWidget);
      expect(find.text('Physiotherapy Session'), findsOneWidget);
    });

    testWidgets('ProviderActiveFlowScreen renders incoming dispatch countdown alert', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ProviderActiveFlowScreen(),
          ),
        ),
      );

      expect(find.text('Incoming Dispatch Alert'), findsOneWidget);
      expect(find.text('New Home Visit Request!'), findsOneWidget);
      expect(find.text('Accept Visit'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);
    });
  });
}
