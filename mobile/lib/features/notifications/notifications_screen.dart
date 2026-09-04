import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_providers.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/notifications');
      final dynamic raw = res.data;
      final List list = raw is List ? raw : (raw is Map && raw['data'] is List ? raw['data'] : []);
      if (mounted) {
        setState(() {
          _notifications = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _notifications = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none_outlined, size: 54, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      const Text('No notifications yet.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black54)),
                      const SizedBox(height: 6),
                      const Text('Alerts about bookings and visits will appear here.', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _notifications.length,
                  itemBuilder: (context, idx) {
                    final n = _notifications[idx] is Map<String, dynamic> ? _notifications[idx] as Map<String, dynamic> : <String, dynamic>{};
                    final title = n['title']?.toString() ?? 'Notification';
                    final body = n['body']?.toString() ?? n['message']?.toString() ?? '';
                    final time = n['createdAt']?.toString().split('T')[0] ?? '';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: theme.primaryColor.withValues(alpha: 0.1),
                          child: Icon(Icons.info_outline, color: theme.primaryColor),
                        ),
                        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(body),
                        trailing: Text(time, style: const TextStyle(fontSize: 10, color: Color(0xFF8A9AAA))),
                      ),
                    );
                  },
                ),
    );
  }
}
