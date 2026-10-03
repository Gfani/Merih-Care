import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/theme_provider.dart';
import '../auth/auth_provider.dart';
import 'widgets/provider_bottom_nav_bar.dart';

class ProviderProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProviderProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProviderProfileSettingsScreen> createState() => _ProviderProfileSettingsScreenState();
}

class _ProviderProfileSettingsScreenState extends ConsumerState<ProviderProfileSettingsScreen> {
  Map<String, dynamic>? _providerProfile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers/me');
      final dynamic raw = response.data;
      final Map<String, dynamic>? data = (raw is Map<String, dynamic> && raw.containsKey('data') && raw['data'] is Map<String, dynamic>)
          ? raw['data'] as Map<String, dynamic>
          : (raw is Map<String, dynamic> ? raw : null);
      if (mounted) {
        setState(() {
          _providerProfile = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _confirmSignOut() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of your provider account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authProvider.notifier).logout();
              if (mounted) {
                context.go('/login');
              }
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  void _showSettingsModal() {
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Consumer(
        builder: (bottomSheetCtx, bottomRef, _) {
          final isDarkActive = bottomRef.watch(themeModeProvider) == ThemeMode.dark ||
              (bottomRef.watch(themeModeProvider) == ThemeMode.system &&
                  Theme.of(bottomSheetCtx).brightness == Brightness.dark);
          final modalBg = isDarkActive ? const Color(0xFF1E293B) : Colors.white;
          final modalText = isDarkActive ? Colors.white : const Color(0xFF1E293B);

          return SafeArea(
            child: Container(
              color: modalBg,
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: 20 + MediaQuery.of(bottomSheetCtx).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('App Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: modalText)),
                      IconButton(
                        icon: Icon(Icons.close, size: 20, color: modalText),
                        onPressed: () => Navigator.pop(bottomSheetCtx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F5F2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.language, color: Color(0xFF0D7C6A), size: 20),
                    ),
                    title: Text('Language / ቋንቋ', style: TextStyle(fontWeight: FontWeight.w600, color: modalText)),
                    subtitle: const Text('English · አማርኛ · Afaan Oromoo · ትግርኛ', style: TextStyle(fontSize: 12)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () {
                      Navigator.pop(bottomSheetCtx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Language selection updated')),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F5F2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.dark_mode_outlined, color: Color(0xFF0D7C6A), size: 20),
                    ),
                    title: Text('Dark Mode', style: TextStyle(fontWeight: FontWeight.w600, color: modalText)),
                    subtitle: const Text('Toggle light or dark theme', style: TextStyle(fontSize: 12)),
                    trailing: Switch(
                      value: isDarkActive,
                      activeColor: const Color(0xFF0D7C6A),
                      onChanged: (val) {
                        bottomRef.read(themeModeProvider.notifier).toggleTheme(val);
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final name = _providerProfile?['name'] ?? user?['name'] ?? 'Healthcare Provider';
    final title = _providerProfile?['title'] ?? user?['title'] ?? 'General Practitioner (MD)';
    final rating = (_providerProfile?['rating'] as num?)?.toDouble() ?? 4.9;
    final reviewCount = (_providerProfile?['reviewCount'] as num?)?.toInt() ?? 84;
    final experience = (_providerProfile?['experience'] as num?)?.toInt() ?? 6;
    final isVerified = _providerProfile?['verified'] == true || _providerProfile?['isApproved'] == true;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scaffoldBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textCol = isDark ? Colors.white : const Color(0xFF1E293B);
    final textSubCol = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
    final dividerCol = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        title: Text('Provider Profile & Settings', style: TextStyle(color: textCol, fontWeight: FontWeight.bold)),
        backgroundColor: cardBg,
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      bottomNavigationBar: const ProviderBottomNavBar(currentIndex: 4),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D7C6A)))
            : SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Top Profile Card ──────────────────────────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderCol),
                  boxShadow: isDark
                      ? []
                      : [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 34,
                          backgroundColor: const Color(0xFF0D7C6A).withOpacity(0.12),
                          child: Text(
                            name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'P',
                            style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0D7C6A),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: textCol,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                title,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: textSubCol,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDCFCE7),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          isVerified ? Icons.verified : Icons.access_time,
                                          size: 13,
                                          color: const Color(0xFF166534),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          isVerified ? 'Verified Clinician' : 'Pending Verification',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF166534),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    Divider(height: 28, color: dividerCol),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStat('Rating', '$rating ★ ($reviewCount)', textCol, textSubCol),
                        _buildStat('Experience', '$experience Years', textCol, textSubCol),
                        _buildStat('Status', 'On Duty', textCol, textSubCol),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ─── Settings & Action Menu ─────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderCol),
                ),
                child: Column(
                  children: [
                    _buildMenuItem(
                      icon: Icons.person_outline_rounded,
                      iconColor: const Color(0xFF0D7C6A),
                      iconBgColor: const Color(0xFFE6F5F2),
                      title: 'Edit Profile Details',
                      subtitle: 'Name, specialized services, visit fees, bio',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () => context.push('/provider/edit-profile'),
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.schedule_rounded,
                      iconColor: const Color(0xFF0284C7),
                      iconBgColor: const Color(0xFFE0F2FE),
                      title: 'Availability & Working Hours',
                      subtitle: 'Manage duty hours and time slots',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () => context.push('/provider/availability'),
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.verified_user_rounded,
                      iconColor: const Color(0xFF16A34A),
                      iconBgColor: const Color(0xFFDCFCE7),
                      title: 'Verification & Credentials',
                      subtitle: 'Medical licenses, degrees & legal documents',
                      badgeText: 'Verified',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () => context.push('/provider/verification'),
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.account_balance_rounded,
                      iconColor: const Color(0xFF8B5CF6),
                      iconBgColor: const Color(0xFFF3E8FF),
                      title: 'Payout Methods',
                      subtitle: 'Telebirr & CBE accounts for withdrawal',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () => context.push('/provider/payout-methods'),
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.receipt_long_rounded,
                      iconColor: const Color(0xFFD97706),
                      iconBgColor: const Color(0xFFFEF3C7),
                      title: 'Payment Receipts',
                      subtitle: 'View appointment receipts and ledger',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () => context.push('/receipts'),
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.settings_rounded,
                      iconColor: const Color(0xFF475569),
                      iconBgColor: const Color(0xFFF1F5F9),
                      title: 'Settings',
                      subtitle: 'App language, dark theme & notifications',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: _showSettingsModal,
                    ),
                    _buildDivider(dividerCol),
                    _buildMenuItem(
                      icon: Icons.help_outline_rounded,
                      iconColor: const Color(0xFFEA580C),
                      iconBgColor: const Color(0xFFFFEDD5),
                      title: 'Help & Support',
                      subtitle: 'Clinical support: support@merihcare.live',
                      textCol: textCol,
                      subCol: textSubCol,
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Support line: support@merihcare.live | +251 939 044 079')),
                        );
                      },
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ─── Switch to Patient Mode Button ─────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0D7C6A),
                    side: const BorderSide(color: Color(0xFF0D7C6A), width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.swap_horiz_rounded),
                  label: const Text(
                    'Switch to Patient Mode',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  onPressed: () => context.go('/dashboard'),
                ),
              ),

              const SizedBox(height: 16),

              // ─── Sign Out ──────────────────────────────────────────────────────
              Center(
                child: TextButton(
                  onPressed: _confirmSignOut,
                  child: const Text(
                    'Sign Out',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, Color textCol, Color subCol) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: textCol,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: subCol),
        ),
      ],
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    String? badgeText,
    required Color textCol,
    required Color subCol,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: textCol,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: subCol),
                  ),
                ],
              ),
            ),
            if (badgeText != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F5F2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  badgeText,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0D7C6A),
                  ),
                ),
              ),
              const SizedBox(width: 6),
            ],
            const Icon(Icons.chevron_right, size: 20, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _buildDivider(Color dividerCol) {
    return Divider(height: 1, indent: 64, endIndent: 16, color: dividerCol);
  }
}
