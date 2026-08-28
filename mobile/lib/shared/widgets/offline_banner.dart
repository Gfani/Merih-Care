import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/connectivity/connectivity_service.dart';

/// Persistent top-of-screen banner shown whenever the device goes offline.
/// Wrap inside a [Column] or [Stack] — it renders 0-height when online.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivityAsync = ref.watch(connectivityProvider);

    return connectivityAsync.when(
      data: (isOnline) {
        if (isOnline) return const SizedBox.shrink();
        return Semantics(
          label: 'Offline warning: you are not connected to the internet',
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: double.infinity,
            color: const Color(0xFFF59E0B),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.wifi_off_rounded, color: Colors.white, size: 16),
                SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'You are offline. Some features may be unavailable.',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
