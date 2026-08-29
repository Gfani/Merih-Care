import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/location/location_service.dart';

class EmergencyScreen extends ConsumerStatefulWidget {
  const EmergencyScreen({super.key});

  @override
  ConsumerState<EmergencyScreen> createState() => _EmergencyScreenState();
}

class _EmergencyScreenState extends ConsumerState<EmergencyScreen> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _activated = false;
  bool _searching = false;
  String _status = 'Double-tap or Hold to Trigger Alert';
  int _etaSeconds = 900; // 15 mins
  Timer? _etaTimer;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
      lowerBound: 0.8,
      upperBound: 1.2,
    )..repeat(reverse: true);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(locationProvider.notifier).autoDetectCurrentLocation();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _etaTimer?.cancel();
    super.dispose();
  }

  void _triggerEmergency() {
    if (_activated) return;
    final loc = ref.read(locationProvider).location;
    final locDesc = loc != null ? 'at ${loc.shortAddress}' : '';

    setState(() {
      _activated = true;
      _searching = true;
      _status = 'Uploading coordinates $locDesc & searching nearest responder...';
    });

    // Simulate GPS upload and search
    Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _searching = false;
          _status = 'Emergency Unit Dispatched to $locDesc! Dr. Meron Alemu is on the way.';
        });
        _startEtaCountdown();
      }
    });
  }

  void _startEtaCountdown() {
    _etaTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_etaSeconds > 0) {
        setState(() => _etaSeconds--);
      } else {
        _etaTimer?.cancel();
      }
    });
  }

  String _formatDuration(int totalSecs) {
    final mins = totalSecs ~/ 60;
    final secs = totalSecs % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final locationState = ref.watch(locationProvider);
    final location = locationState.location;

    return Scaffold(
      appBar: AppBar(title: const Text('Emergency Assistance')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Live GPS Status Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.gps_fixed, color: Colors.red, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    locationState.isDetecting
                        ? 'Acquiring high-accuracy GPS fix...'
                        : '📍 GPS: ${location?.shortAddress ?? "Addis Ababa"} (${location?.latitude.toStringAsFixed(4)}, ${location?.longitude.toStringAsFixed(4)})',
                    style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Icon(Icons.emergency, color: Colors.red, size: 64),
            const SizedBox(height: 16),
            Text(
              _status,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: _activated ? Colors.red : const Color(0xFF18232E),
              ),
            ),
            const SizedBox(height: 48),
            // Siren button
            Center(
              child: ScaleTransition(
                scale: _pulseController,
                child: GestureDetector(
                  onDoubleTap: _triggerEmergency,
                  onLongPress: _triggerEmergency,
                  child: Container(
                    width: 160,
                    height: 160,
                    decoration: BoxDecoration(
                      color: _activated ? Colors.red : const Color(0xFFDC2626),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.red.withOpacity(0.3),
                          blurRadius: 16,
                          spreadRadius: 8,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.notifications_active_outlined, color: Colors.white, size: 48),
                          const SizedBox(height: 8),
                          Text(
                            _activated ? 'ACTIVE' : 'PANIC',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 48),
            if (_searching)
              const Column(
                children: [
                  CircularProgressIndicator(color: Colors.red),
                  SizedBox(height: 12),
                  Text('Locking live GPS coordinates...', style: TextStyle(color: Color(0xFF8A9AAA))),
                ],
              ),
            if (_activated && !_searching) ...[
              // ETA Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8EE)),
                ),
                child: Column(
                  children: [
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.directions_car, color: Colors.red),
                        SizedBox(width: 8),
                        Text('RESPONDER ESTIMATED ARRIVAL', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF8A9AAA))),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _formatDuration(_etaSeconds),
                      style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF18232E)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  _etaTimer?.cancel();
                  setState(() {
                    _activated = false;
                    _etaSeconds = 900;
                    _status = 'Double-tap or Hold to Trigger Alert';
                  });
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E293B)),
                child: const Text('Cancel Request / Stand Down'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
