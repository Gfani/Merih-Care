import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
class StatusBadgeWidget extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadgeWidget({
    super.key,
    required this.status,
    this.fontSize = 11.0,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    Color dot;
    String label;

    switch (status.toLowerCase()) {
      case 'searching':
        bg = const Color(0xFFDBEAFE);
        text = const Color(0xFF1E40AF);
        dot = const Color(0xFF3B82F6);
        label = 'Searching';
        break;
      case 'accepted':
      case 'active':
      case 'verified':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF166534);
        dot = const Color(0xFF16A34A);
        label = status.toLowerCase() == 'verified' ? 'Verified' : 'Accepted';
        break;
      case 'scheduled':
        bg = const Color(0xFFE6F5F2);
        text = const Color(0xFF0A5C4E);
        dot = const Color(0xFF0D7C6A);
        label = 'Scheduled';
        break;
      case 'on_the_way':
        bg = const Color(0xFFDBEAFE);
        text = const Color(0xFF1E40AF);
        dot = const Color(0xFF3B82F6);
        label = 'On the Way';
        break;
      case 'arrived':
        bg = const Color(0xFFEDE9FE);
        text = const Color(0xFF5B21B6);
        dot = const Color(0xFF7C3AED);
        label = 'Arrived';
        break;
      case 'in_progress':
        bg = const Color(0xFFDBEAFE);
        text = const Color(0xFF1E40AF);
        dot = const Color(0xFF3B82F6);
        label = 'In Progress';
        break;
      case 'completed':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF166534);
        dot = const Color(0xFF16A34A);
        label = 'Completed';
        break;
      case 'cancelled':
      case 'rejected':
      case 'suspended':
        bg = const Color(0xFFFEE2E2);
        text = const Color(0xFF991B1B);
        dot = const Color(0xFFDC2626);
        label = status[0].toUpperCase() + status.substring(1);
        break;
      case 'pending':
      default:
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFF92400E);
        dot = const Color(0xFFD97706);
        label = 'Pending';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: dot,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: text,
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── VERIFIED BADGE ──────────────────────────────────────────────────────────
class VerifiedBadgeWidget extends StatelessWidget {
  final double size;

  const VerifiedBadgeWidget({super.key, this.size = 14.0});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(
        color: AppTheme.primaryColor,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.check,
        size: size - 4,
        color: Colors.white,
      ),
    );
  }
}

// ─── AVATAR WIDGET ───────────────────────────────────────────────────────────
class AvatarWidget extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final bool verified;

  const AvatarWidget({
    super.key,
    this.imageUrl,
    required this.name,
    this.radius = 20.0,
    this.verified = false,
  });

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase();

    return Stack(
      clipBehavior: Clip.none,
      children: [
        CircleAvatar(
          radius: radius,
          backgroundColor: AppTheme.primaryLight,
          backgroundImage: imageUrl != null && imageUrl!.startsWith('http')
              ? NetworkImage(imageUrl!)
              : null,
          child: imageUrl == null || !imageUrl!.startsWith('http')
              ? Text(
                  initials.isEmpty ? 'U' : initials,
                  style: TextStyle(
                    color: AppTheme.primaryColor,
                    fontWeight: FontWeight.bold,
                    fontSize: radius * 0.75,
                  ),
                )
              : null,
        ),
        if (verified)
          Positioned(
            right: -2,
            bottom: -2,
            child: VerifiedBadgeWidget(size: radius * 0.8),
          ),
      ],
    );
  }
}

// ─── RATING WIDGET ───────────────────────────────────────────────────────────
class RatingWidget extends StatelessWidget {
  final double rating;
  final int? reviewCount;

  const RatingWidget({
    super.key,
    required this.rating,
    this.reviewCount,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, size: 16, color: AppTheme.warningColor),
        const SizedBox(width: 3),
        Text(
          rating.toStringAsFixed(1),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: AppTheme.textPrimary,
          ),
        ),
        if (reviewCount != null) ...[
          const SizedBox(width: 2),
          Text(
            '($reviewCount)',
            style: const TextStyle(
              fontSize: 11,
              color: AppTheme.textMuted,
            ),
          ),
        ],
      ],
    );
  }
}

// ─── CARD WIDGET ─────────────────────────────────────────────────────────────
class CardWidget extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Border? border;

  const CardWidget({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: border ?? Border.all(color: AppTheme.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: cardContent,
      );
    }

    return cardContent;
  }
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
class SectionHeaderWidget extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionHeaderWidget({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
            letterSpacing: -0.2,
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(50, 30),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              actionLabel!,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── PROVIDER CARD ───────────────────────────────────────────────────────────
class ProviderCardWidget extends StatelessWidget {
  final Map<String, dynamic> provider;
  final VoidCallback onTap;
  final bool compact;

  const ProviderCardWidget({
    super.key,
    required this.provider,
    required this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final name = provider['name'] ?? 'Provider';
    final title = provider['title'] ?? provider['specialty'] ?? 'Specialist';
    final rating = (provider['rating'] as num?)?.toDouble() ?? 4.9;
    final reviewCount = provider['reviewCount'] as int? ?? 28;
    final price = provider['pricePerVisit'] ?? provider['price'] ?? 600;
    final distance = provider['distance'] ?? '2.4 km';
    final avatar = provider['avatar'];
    final verified = provider['verified'] == true || provider['status'] == 'verified';

    if (compact) {
      return CardWidget(
        onTap: onTap,
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                AvatarWidget(name: name, imageUrl: avatar, radius: 18, verified: verified),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary),
                      ),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                RatingWidget(rating: rating, reviewCount: reviewCount),
                Text(
                  '$distance',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'ETB $price / visit',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
            ),
          ],
        ),
      );
    }

    return CardWidget(
      onTap: onTap,
      child: Row(
        children: [
          AvatarWidget(name: name, imageUrl: avatar, radius: 24, verified: verified),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                ),
                Text(
                  title,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    RatingWidget(rating: rating, reviewCount: reviewCount),
                    const SizedBox(width: 12),
                    Text(
                      '•  $distance',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'ETB $price',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryColor),
              ),
              const SizedBox(height: 6),
              const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.borderStrong),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── APPOINTMENT CARD ────────────────────────────────────────────────────────
class AppointmentCardWidget extends StatelessWidget {
  final Map<String, dynamic> appointment;
  final VoidCallback onTap;

  const AppointmentCardWidget({
    super.key,
    required this.appointment,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final service = appointment['service'] ?? appointment['serviceName'] ?? 'Home Healthcare Visit';
    final providerName = appointment['provider']?['name'] ?? appointment['providerName'] ?? 'Assigned Provider';
    final date = appointment['date'] ?? appointment['scheduledDate'] ?? 'Today';
    final time = appointment['time'] ?? appointment['scheduledTime'] ?? '10:00 AM';
    final status = appointment['status'] ?? 'scheduled';

    return CardWidget(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 12, color: AppTheme.textSecondary),
                    const SizedBox(width: 6),
                    Text('$date  ·  $time', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  ],
                ),
              ),
              StatusBadgeWidget(status: status),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            service,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.person_pin_circle_outlined, size: 14, color: AppTheme.textMuted),
              const SizedBox(width: 4),
              Text(
                providerName,
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── STEP PROGRESS ───────────────────────────────────────────────────────────
class StepProgressWidget extends StatelessWidget {
  final List<String> steps;
  final int currentStep;

  const StepProgressWidget({
    super.key,
    required this.steps,
    required this.currentStep,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(steps.length * 2 - 1, (index) {
        if (index.isOdd) {
          final stepIndex = index ~/ 2;
          final isDone = stepIndex < currentStep;
          return Expanded(
            child: Container(
              height: 2,
              color: isDone ? AppTheme.primaryColor : AppTheme.borderColor,
            ),
          );
        }

        final stepIndex = index ~/ 2;
        final isActive = stepIndex == currentStep;
        final isDone = stepIndex < currentStep;

        return Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: isDone
                ? AppTheme.primaryColor
                : (isActive ? AppTheme.primaryLight : Colors.white),
            shape: BoxShape.circle,
            border: Border.all(
              color: isDone || isActive ? AppTheme.primaryColor : AppTheme.borderColor,
              width: 1.5,
            ),
          ),
          child: Center(
            child: isDone
                ? const Icon(Icons.check, size: 14, color: Colors.white)
                : Text(
                    '${stepIndex + 1}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isActive ? AppTheme.primaryColor : AppTheme.textMuted,
                    ),
                  ),
          ),
        );
      }),
    );
  }
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
class StatCardWidget extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;

  const StatCardWidget({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.iconColor = AppTheme.primaryColor,
    this.iconBg = AppTheme.primaryLight,
  });

  @override
  Widget build(BuildContext context) {
    return CardWidget(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
