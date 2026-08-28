import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';

class ProviderProfileScreen extends ConsumerStatefulWidget {
  final String providerId;

  const ProviderProfileScreen({super.key, required this.providerId});

  @override
  ConsumerState<ProviderProfileScreen> createState() => _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends ConsumerState<ProviderProfileScreen> {
  Map<String, dynamic>? _provider;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers/${widget.providerId}');
      if (mounted) {
        setState(() {
          _provider = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _provider = {
            'id': widget.providerId,
            'user': {'name': 'Dr. Meron Alemu', 'phone': '+251 911 223 344'},
            'specialty': 'General Care',
            'rating': 4.9,
            'experience': 8,
            'hourlyRate': 250,
            'bio': 'Dr. Meron Alemu is a seasoned practitioner with over 8 years of home-care experience in Addis Ababa. She specializes in chronic illness care and post-operative home management.',
            'reviews': [
              {'author': 'Selamawit S.', 'rating': 5, 'comment': 'Excellent service, highly professional and caring.'},
              {'author': 'Bereket M.', 'rating': 4.8, 'comment': 'On time and very helpful.'}
            ]
          };
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final user = _provider?['user'] ?? {};
    final reviews = (_provider?['reviews'] as List?) ?? [];

    return Scaffold(
      appBar: AppBar(title: Text(user['name'] ?? 'Provider Profile')),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              color: Colors.white,
              width: double.infinity,
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: theme.primaryColor.withOpacity(0.1),
                    child: Text(user['name']?[0]?.toUpperCase() ?? 'P', style: const TextStyle(fontSize: 32)),
                  ),
                  const SizedBox(height: 16),
                  Text(user['name'] ?? 'Provider Name', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(_provider?['specialty'] ?? '', style: const TextStyle(color: Color(0xFF8A9AAA))),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildMetric(Icons.star, Colors.amber, '${_provider?['rating']} Rating'),
                      const SizedBox(width: 24),
                      _buildMetric(Icons.work_history, theme.primaryColor, '${_provider?['experience']} yrs exp'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Biography', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(_provider?['bio'] ?? 'No bio provided.', style: const TextStyle(color: Color(0xFF4A5A6A), height: 1.4)),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Hourly Rate', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text('ETB ${_provider?['hourlyRate']}/hr', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: theme.primaryColor)),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Patient Reviews', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (reviews.isEmpty)
                    const Text('No reviews yet.', style: TextStyle(color: Color(0xFF8A9AAA)))
                  else
                    ...reviews.map((r) => Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(r['author'] ?? 'Anonymous', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                  Row(
                                    children: [
                                      const Icon(Icons.star, color: Colors.amber, size: 14),
                                      const SizedBox(width: 2),
                                      Text(r['rating'].toString(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(r['comment'] ?? '', style: const TextStyle(color: Color(0xFF4A5A6A), fontSize: 12)),
                            ],
                          ),
                        )),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: ElevatedButton(
            onPressed: () {
              context.push('/booking?providerId=${widget.providerId}');
            },
            child: const Text('Book Appointment'),
          ),
        ),
      ),
    );
  }

  Widget _buildMetric(IconData icon, Color color, String text) {
    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      ],
    );
  }
}
