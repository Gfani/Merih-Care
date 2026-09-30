import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ProviderRequestsScreen extends ConsumerStatefulWidget {
  const ProviderRequestsScreen({super.key});

  @override
  ConsumerState<ProviderRequestsScreen> createState() => _ProviderRequestsScreenState();
}

class _ProviderRequestsScreenState extends ConsumerState<ProviderRequestsScreen> {
  final List<Map<String, dynamic>> _requests = [
    {
      'id': 'req-1',
      'title': 'Home Nursing',
      'price': 'ETB 750',
      'patientName': 'Selamawit Tadesse',
      'date': '2026-08-26 16:00',
      'distance': '1.4 km',
      'note': 'Post-surgery wound care and dressing change',
      'timeReceived': 'Received 08:14 AM',
      'avatarUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    },
    {
      'id': 'req-2',
      'title': 'Medication Assist',
      'price': 'ETB 380',
      'patientName': 'Frehiwot Solomon',
      'date': '2026-08-26 12:00',
      'distance': '3.2 km',
      'note': 'Daily insulin injection management for elderly parent',
      'timeReceived': 'Received 07:30 AM',
      'avatarUrl': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
    {
      'id': 'req-3',
      'title': 'Wound Care',
      'price': 'ETB 500',
      'patientName': 'Dawit Haile',
      'date': '2026-08-27 10:30',
      'distance': '0.9 km',
      'note': 'Burn wound dressing — requires sterile technique',
      'timeReceived': 'Received 06:55 AM',
      'avatarUrl': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            const Text(
              'Requests',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFDC2626),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_requests.length} new',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _requests.length,
        itemBuilder: (context, index) {
          final req = _requests[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Avatar, Title, Patient Name, Price
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFFE2E8F0),
                      backgroundImage: NetworkImage(req['avatarUrl']),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                req['title'],
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              Text(
                                req['price'],
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0D7C6A),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            req['patientName'],
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Meta Row: Date/Time + Distance
                Row(
                  children: [
                    const Icon(Icons.calendar_month_outlined, size: 15, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text(
                      req['date'],
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 16),
                    const Icon(Icons.location_on_outlined, size: 15, color: Color(0xFFEF4444)),
                    const SizedBox(width: 4),
                    Text(
                      req['distance'],
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Clinical Note Container
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                  ),
                  child: Text(
                    req['note'],
                    style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
                  ),
                ),
                const SizedBox(height: 8),

                // Time Received
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      req['timeReceived'],
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                    InkWell(
                      onTap: () {
                        context.push('/provider/active-request', extra: req);
                      },
                      child: Row(
                        children: const [
                          Text(
                            'View Details',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0D7C6A),
                            ),
                          ),
                          SizedBox(width: 2),
                          Icon(Icons.chevron_right, size: 16, color: Color(0xFF0D7C6A)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1, // Requests active
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/provider-dashboard');
              break;
            case 1:
              break;
            case 2:
              context.push('/provider/availability');
              break;
            case 3:
              context.push('/chat/apt-101');
              break;
            case 4:
              context.push('/provider/profile');
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
            icon: Badge(
              label: Text('3'),
              backgroundColor: Color(0xFFDC2626),
              child: Icon(Icons.assignment_outlined),
            ),
            selectedIcon: Badge(
              label: Text('3'),
              backgroundColor: Color(0xFFDC2626),
              child: Icon(Icons.assignment, color: Color(0xFF0D7C6A)),
            ),
            label: 'Requests',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month, color: Color(0xFF0D7C6A)),
            label: 'Schedule',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble, color: Color(0xFF0D7C6A)),
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
}
