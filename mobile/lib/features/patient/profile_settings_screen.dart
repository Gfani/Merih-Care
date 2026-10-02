import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../core/network/network_providers.dart';

class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  int _appointmentsCount = 8;
  int _completedCount = 5;
  double _avgRating = 4.8;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _fetchProfile());
  }

  Future<void> _fetchProfile() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/auth/profile');
      final dynamic data = response.data;
      if (data is Map<String, dynamic> && mounted) {
        ref.read(authProvider.notifier).updateUser(data);
      }
    } catch (_) {}
  }

  void _confirmSignOut() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to sign out of your MerihCare account?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authProvider.notifier).logout();
              if (mounted) context.go('/login');
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user ?? {};

    final displayName = (user['name'] != null && user['name'].toString().trim().isNotEmpty)
        ? user['name'].toString().trim()
        : 'Tigist Bekele';
    final displayPhone = (user['phone'] != null && user['phone'].toString().trim().isNotEmpty)
        ? user['phone'].toString().trim()
        : '+251 91 234 5678';
    final displayEmail = (user['email'] != null && user['email'].toString().trim().isNotEmpty)
        ? user['email'].toString().trim()
        : 'tigist.bekele@email.com';

    final bool isProviderAccount = user['role'] == 'provider' ||
        user['hasProviderAccount'] == true ||
        (user['roles'] is List && (user['roles'] as List).contains('provider')) ||
        (user['roles'] is String && (user['roles'] as String).contains('provider')) ||
        user['provider'] != null ||
        user['providerId'] != null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Profile',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        child: Column(
          children: [
            // ─── User Profile Header Card ──────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const CircleAvatar(
                        radius: 34,
                        backgroundImage: NetworkImage(
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              displayPhone,
                              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              displayEmail,
                              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ─── 3 Stats Columns inside Soft Grey Box ─────────────────────
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        _buildStatColumn('$_appointmentsCount', 'Appointments'),
                        Container(width: 1, height: 26, color: const Color(0xFFE2E8F0)),
                        _buildStatColumn('$_completedCount', 'Completed'),
                        Container(width: 1, height: 26, color: const Color(0xFFE2E8F0)),
                        _buildStatColumn('$_avgRating', 'Avg Rating'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ─── Menu Items List ───────────────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildMenuItem(
                    icon: Icons.local_hospital_rounded,
                    iconColor: const Color(0xFF8B5CF6),
                    iconBgColor: const Color(0xFFF3E8FF),
                    title: 'Medical Information',
                    badgeText: 'Private',
                    onTap: () => context.push('/medical-information'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.receipt_long_rounded,
                    iconColor: const Color(0xFF64748B),
                    iconBgColor: const Color(0xFFF1F5F9),
                    title: 'Payment History',
                    onTap: () => context.push('/receipts'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.credit_card_rounded,
                    iconColor: const Color(0xFF0284C7),
                    iconBgColor: const Color(0xFFE0F2FE),
                    title: 'Payment Methods',
                    onTap: () => context.push('/payout-methods'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.location_on_rounded,
                    iconColor: const Color(0xFFE11D48),
                    iconBgColor: const Color(0xFFFFF1F2),
                    title: 'Saved Addresses',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Saved addresses feature coming soon.')),
                      );
                    },
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.notifications_rounded,
                    iconColor: const Color(0xFFD97706),
                    iconBgColor: const Color(0xFFFEF3C7),
                    title: 'Notifications',
                    onTap: () => context.push('/notifications'),
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.lock_rounded,
                    iconColor: const Color(0xFFEA580C),
                    iconBgColor: const Color(0xFFFFEDD5),
                    title: 'Privacy & Security',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('All data is encrypted end-to-end.')),
                      );
                    },
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.help_outline_rounded,
                    iconColor: const Color(0xFFDC2626),
                    iconBgColor: const Color(0xFFFEE2E2),
                    title: 'Help & Support',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Contact support: support@merihcare.live')),
                      );
                    },
                  ),
                  _buildDivider(),
                  _buildMenuItem(
                    icon: Icons.settings_rounded,
                    iconColor: const Color(0xFF8B5CF6),
                    iconBgColor: const Color(0xFFF3E8FF),
                    title: 'Settings',
                    onTap: () {
                      _showLanguageAndThemeModal();
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Provider Switch (Only for clinicians)
            if (isProviderAccount) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 16),
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0D7C6A),
                    side: const BorderSide(color: Color(0xFF0D7C6A)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.swap_horiz_rounded),
                  label: const Text('Switch to Provider Mode', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: () => context.go('/provider-dashboard'),
                ),
              ),
            ],

            // ─── Red Sign Out Button ───────────────────────────────────────────
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
            const SizedBox(height: 20),
          ],
        ),
      ),
    ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 4, // Profile active
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/dashboard');
              break;
            case 1:
              context.push('/services');
              break;
            case 2:
              context.push('/appointments');
              break;
            case 3:
              context.push('/chat/apt-101');
              break;
            case 4:
              break;
          }
        },
        backgroundColor: Colors.white,
        elevation: 2,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: Color(0xFF0D7C6A)),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.layers_outlined),
            selectedIcon: Icon(Icons.layers, color: Color(0xFF0D7C6A)),
            label: 'Services',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month, color: Color(0xFF0D7C6A)),
            label: 'Appointments',
          ),
          NavigationDestination(
            icon: Badge(
              label: Text('1'),
              backgroundColor: Color(0xFFDC2626),
              child: Icon(Icons.chat_bubble_outline),
            ),
            selectedIcon: Badge(
              label: Text('1'),
              backgroundColor: Color(0xFFDC2626),
              child: Icon(Icons.chat_bubble, color: Color(0xFF0D7C6A)),
            ),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: Color(0xFF0D7C6A)),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  Widget _buildStatColumn(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    String? badgeText,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1E293B),
                ),
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

  Widget _buildDivider() {
    return const Divider(height: 1, indent: 56, endIndent: 16, color: Color(0xFFF1F5F9));
  }

  void _showLanguageAndThemeModal() {
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: 24 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('App Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(ctx),
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
                title: const Text('Language / ቋንቋ', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('English · አማርኛ · Afaan Oromoo · ትግርኛ', style: TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, size: 20),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Language preference saved.')),
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
                title: const Text('Dark Mode', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Toggle light or dark appearance', style: TextStyle(fontSize: 12)),
                trailing: Switch(
                  value: Theme.of(context).brightness == Brightness.dark,
                  activeColor: const Color(0xFF0D7C6A),
                  onChanged: (val) {
                    Navigator.pop(ctx);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
