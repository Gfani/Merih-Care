import 'package:flutter/material.dart';

class MerihcareApp extends StatelessWidget {
  const MerihcareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Merihcare',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0D7C6A)),
        useMaterial3: true,
      ),
      home: const Scaffold(
        body: Center(
          child: Text('Welcome to Merihcare'),
        ),
      ),
    );
  }
}
