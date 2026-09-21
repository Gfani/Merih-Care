import 'package:flutter/material.dart';

/// Modern Clinician Pin Marker with status aura and optional pulse animation
class ClinicianMapMarker extends StatelessWidget {
  final String? name;
  final String? avatarUrl;
  final bool isSelected;
  final bool isEnRoute;
  final VoidCallback? onTap;

  const ClinicianMapMarker({
    super.key,
    this.name,
    this.avatarUrl,
    this.isSelected = false,
    this.isEnRoute = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final primaryColor = isEnRoute ? const Color(0xFF0D7C6A) : (isSelected ? const Color(0xFF2563EB) : const Color(0xFF10B981));

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // Outer pulsing ripple ring if active/selected
          if (isSelected || isEnRoute)
            _PulsingHalo(color: primaryColor.withValues(alpha: 0.35)),

          // Main Marker Pin
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: primaryColor, width: 3),
              boxShadow: [
                BoxShadow(
                  color: primaryColor.withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
                const BoxShadow(
                  color: Colors.black12,
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: ClipOval(
              child: avatarUrl != null && avatarUrl!.isNotEmpty && avatarUrl!.startsWith('http')
                  ? Image.network(
                      avatarUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildFallbackIcon(primaryColor),
                    )
                  : _buildFallbackIcon(primaryColor),
            ),
          ),

          // Online status or verified indicator badge
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: const Icon(Icons.check, size: 8, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFallbackIcon(Color color) {
    return Container(
      color: const Color(0xFFF0FDF4),
      child: Center(
        child: Icon(
          Icons.medical_services_rounded,
          size: 20,
          color: color,
        ),
      ),
    );
  }
}

/// Floating Pill Badge for Provider ETA (e.g., "5 min" or "ETA ~4 min")
class FloatingEtaBadge extends StatelessWidget {
  final String etaText;
  final String? distanceText;
  final bool isWarning;

  const FloatingEtaBadge({
    super.key,
    required this.etaText,
    this.distanceText,
    this.isWarning = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isWarning
                ? [const Color(0xFFF59E0B), const Color(0xFFD97706)]
                : [const Color(0xFF0D7C6A), const Color(0xFF0F9B84)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: (isWarning ? Colors.amber.shade900 : const Color(0xFF0D7C6A)).withValues(alpha: 0.35),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
            const Icon(
              Icons.directions_car_rounded,
              size: 13,
              color: Colors.white,
            ),
            const SizedBox(width: 4),
            Text(
              etaText,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 11.5,
                letterSpacing: 0.2,
              ),
            ),
            if (distanceText != null && distanceText!.isNotEmpty) ...[
              const SizedBox(width: 4),
              Text(
                '($distanceText)',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Patient Pick-up / Target Location Home Pin Marker
class PatientHomeMarker extends StatelessWidget {
  final String? label;

  const PatientHomeMarker({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (label != null && label!.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              margin: const EdgeInsets.only(bottom: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF0D7C6A),
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Text(
                label!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: const Color(0xFF0D7C6A),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: const [
              BoxShadow(
                color: Colors.black38,
                blurRadius: 8,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.home_filled,
              color: Colors.white,
              size: 18,
            ),
          ),
        ),
      ],
    ),
  );
  }
}

/// Pulsing Halo Effect around target marker
class _PulsingHalo extends StatefulWidget {
  final Color color;

  const _PulsingHalo({required this.color});

  @override
  State<_PulsingHalo> createState() => _PulsingHaloState();
}

class _PulsingHaloState extends State<_PulsingHalo> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final scale = 1.0 + (_controller.value * 0.5);
        final opacity = (1.0 - _controller.value).clamp(0.0, 1.0);

        return Transform.scale(
          scale: scale,
          child: Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: widget.color.withValues(alpha: opacity * 0.4),
              border: Border.all(
                color: widget.color.withValues(alpha: opacity * 0.7),
                width: 1.5,
              ),
            ),
          ),
        );
      },
    );
  }
}
