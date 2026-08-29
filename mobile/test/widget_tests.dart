import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Flutter UI Widget Tests', () {
    testWidgets('Should render primary elevated button and respond to tap', (WidgetTester tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ElevatedButton(
              onPressed: () {
                tapped = true;
              },
              child: const Text('Sign In to Merihcare'),
            ),
          ),
        ),
      );

      expect(find.text('Sign In to Merihcare'), findsOneWidget);

      await tester.tap(find.text('Sign In to Merihcare'));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('Should render text input form field with label and placeholder', (WidgetTester tester) async {
      final controller = TextEditingController();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TextFormField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Email Address',
                hintText: 'patient@merihcare.et',
              ),
            ),
          ),
        ),
      );

      expect(find.text('Email Address'), findsOneWidget);
      expect(find.text('patient@merihcare.et'), findsOneWidget);

      await tester.enterText(find.byType(TextFormField), 'test@merihcare.et');
      expect(controller.text, 'test@merihcare.et');
    });

    testWidgets('Should render location GPS badge widget with coordinates', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Chip(
              avatar: Icon(Icons.my_location, size: 16),
              label: Text('GPS: Bole, Addis Ababa (9.0054, 38.7845)'),
            ),
          ),
        ),
      );

      expect(find.text('GPS: Bole, Addis Ababa (9.0054, 38.7845)'), findsOneWidget);
      expect(find.byIcon(Icons.my_location), findsOneWidget);
    });
  });
}
