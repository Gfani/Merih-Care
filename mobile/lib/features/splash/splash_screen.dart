import 'package:flutter/material.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: const Color(0xFF0D7C6A).withOpacity(0.1),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Center(
                child: Icon(
                  Icons.local_hospital_rounded,
                  size: 48,
                  color: Color(0xFF0D7C6A),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Merihcare',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
                color: Color(0xFF18232E),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Immediate Care at Your Doorstep',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF8A9AAA),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 48),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Color(0xFF0D7C6A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
