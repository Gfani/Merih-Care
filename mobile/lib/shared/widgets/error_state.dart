import 'package:flutter/material.dart';

/// Unified error state widget with optional retry callback.
/// Use inside any screen's body to replace content when a fetch fails.
class ErrorStateWidget extends StatelessWidget {
  final String? message;
  final VoidCallback? onRetry;
  final IconData icon;

  const ErrorStateWidget({
    super.key,
    this.message,
    this.onRetry,
    this.icon = Icons.error_outline_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final msg = message ?? 'Something went wrong.';

    return Semantics(
      label: 'Error: $msg',
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 56, color: const Color(0xFFCBD5E1)),
              const SizedBox(height: 16),
              Text(
                msg,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 24),
                Semantics(
                  button: true,
                  label: 'Retry',
                  child: OutlinedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: theme.primaryColor,
                      side: BorderSide(color: theme.primaryColor),
                      minimumSize: const Size(140, 44),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Loading skeleton — simple centred circular progress with accessible label.
class LoadingStateWidget extends StatelessWidget {
  final String? label;
  const LoadingStateWidget({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label ?? 'Loading',
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}
