import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final List<Map<String, String>> notifs = [
      {
        'id': 'n1',
        'title': 'Booking Confirmed',
        'body': 'Dr. Meron Alemu accepted your General Care consultation.',
        'time': '10 mins ago',
      },
      {
        'id': 'n2',
        'title': 'Payment Invoice',
        'body': 'Stripe transaction completed for ETB 250.00.',
        'time': '15 mins ago',
      }
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: notifs.isEmpty
          ? const Center(child: Text('No notifications yet.'))
          : ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: notifs.length,
              itemBuilder: (context, idx) {
                final n = notifs[idx];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: theme.primaryColor.withOpacity(0.1),
                      child: Icon(Icons.info_outline, color: theme.primaryColor),
                    ),
                    title: Text(n['title']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(n['body']!),
                    trailing: Text(n['time']!, style: const TextStyle(fontSize: 10, color: Color(0xFF8A9AAA))),
                  ),
                );
              },
            ),
    );
  }
}
