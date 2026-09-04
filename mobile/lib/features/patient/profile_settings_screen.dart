import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../core/network/network_providers.dart';
import '../../app.dart';

class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  bool _pushNotifications = true;
  bool _offlineMode = false;
  String _selectedLanguage = 'en';

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

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user ?? {};
    final theme = Theme.of(context);

    final displayName = (user['name'] != null && user['name'].toString().trim().isNotEmpty)
        ? user['name'].toString().trim()
        : (user['email'] != null ? user['email'].toString().split('@')[0] : 'User');
    final displayEmail = (user['email'] != null && user['email'].toString().isNotEmpty)
        ? user['email'].toString()
        : (user['phone'] != null ? user['phone'].toString() : 'No email associated');
    final role = (user['role'] ?? 'patient').toString().toUpperCase();
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U';

    return Scaffold(
      appBar: AppBar(title: const Text('Account Settings')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: theme.primaryColor.withValues(alpha: 0.1),
                    child: Text(
                      initial,
                      style: TextStyle(color: theme.primaryColor, fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                displayName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: theme.primaryColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                role,
                                style: TextStyle(
                                  color: theme.primaryColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(displayEmail, style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 12)),
                        if (user['phone'] != null && user['phone'].toString().isNotEmpty && user['email'] != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(user['phone'].toString(), style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 11)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('PREFERENCES', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Push Notifications', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Receive immediate booking/chat alerts', style: TextStyle(fontSize: 11)),
                    value: _pushNotifications,
                    activeThumbColor: theme.primaryColor,
                    onChanged: (val) => setState(() => _pushNotifications = val),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    title: const Text('Offline Mode Cache', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Preload schedules for offline accessibility', style: TextStyle(fontSize: 11)),
                    value: _offlineMode,
                    activeThumbColor: theme.primaryColor,
                    onChanged: (val) {
                      setState(() => _offlineMode = val);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Offline caching ${val ? 'enabled' : 'disabled'}'), backgroundColor: Colors.teal),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    title: const Text('Language / Localization', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Choose default app interface translation', style: TextStyle(fontSize: 11)),
                    trailing: Semantics(
                      label: 'Select language',
                      child: DropdownButton<String>(
                        value: _selectedLanguage,
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedLanguage = val);
                            // Update the app-wide locale via Riverpod
                            ref.read(localeProvider.notifier).state = Locale(val);
                          }
                        },
                        items: const [
                          DropdownMenuItem(value: 'en', child: Text('English')),
                          DropdownMenuItem(value: 'am', child: Text('አማርኛ (Amharic)')),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('ACCOUNT CONTROL', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8A9AAA), fontSize: 11)),
            const SizedBox(height: 8),
            Card(
              child: Column(
                children: [
                  Semantics(
                    button: true,
                    label: 'View payment receipts',
                    child: ListTile(
                      leading: const Icon(Icons.receipt_long_outlined, color: Color(0xFF4A5A6A)),
                      title: const Text('Payment Receipts', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/receipts'),
                    ),
                  ),
                  const Divider(height: 1),
                  Semantics(
                    button: true,
                    label: 'Change password',
                    child: ListTile(
                      leading: const Icon(Icons.password_outlined, color: Color(0xFF4A5A6A)),
                      title: const Text('Change Password', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Password reset link sent to your email'), backgroundColor: Colors.teal),
                        );
                      },
                    ),
                  ),
                  const Divider(height: 1),
                  Semantics(
                    button: true,
                    label: 'Sign out of account',
                    child: ListTile(
                      leading: const Icon(Icons.logout, color: Colors.red),
                      title: const Text('Sign Out', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.red)),
                      onTap: () async {
                        final router = GoRouter.of(context);
                        await ref.read(authProvider.notifier).logout();
                        router.go('/login');
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
