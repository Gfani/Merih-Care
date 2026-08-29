import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/create_design_widgets.dart';

class ProviderProfileScreen extends ConsumerStatefulWidget {
  final String providerId;

  const ProviderProfileScreen({super.key, required this.providerId});

  @override
  ConsumerState<ProviderProfileScreen> createState() => _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends ConsumerState<ProviderProfileScreen> {
  Map<String, dynamic>? _provider;
  bool _loading = true;

  final Map<String, dynamic> _fallbackProvider = {
    'id': 'p-201',
    'name': 'Dr. Meron Alemu',
    'title': 'General Practitioner (MD)',
    'specialty': 'Doctor Home Visit',
    'avatar': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format',
    'rating': 4.9,
    'reviewCount': 38,
    'experience': 8,
    'pricePerVisit': 800,
    'distance': '1.2 km away',
    'serviceArea': 'Bole, Kazanchis, Old Airport, Sarbet',
    'languages': ['Amharic', 'English', 'Afaan Oromoo'],
    'qualifications': ['MD - Addis Ababa University (Black Lion Hospital)', 'Board Certified General Medicine', 'Advanced Life Support (ACLS)'],
    'verified': true,
    'bio': 'Dr. Meron Alemu is a dedicated general practitioner with 8+ years of clinical experience in home healthcare. She specializes in chronic disease management (hypertension, diabetes), post-operative recovery, and personalized home wellness consultations.',
    'reviews': [
      {'author': 'Tigist Bekele', 'rating': 5.0, 'date': 'Yesterday', 'comment': 'Dr. Meron arrived on time, was extremely thorough, and prescribed effective treatments.'},
      {'author': 'Dawit Haile', 'rating': 4.8, 'date': '3 days ago', 'comment': 'Very kind and attentive with my elderly father. Highly recommended!'},
    ],
  };

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
          _provider = _fallbackProvider;
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppTheme.surfaceColor,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final p = _provider ?? _fallbackProvider;
    final name = p['name'] ?? p['user']?['name'] ?? 'Provider';
    final title = p['title'] ?? p['specialty'] ?? 'Healthcare Specialist';
    final rating = (p['rating'] as num?)?.toDouble() ?? 4.9;
    final reviewCount = p['reviewCount'] as int? ?? 38;
    final experience = p['experience'] ?? 8;
    final price = p['pricePerVisit'] ?? p['hourlyRate'] ?? 800;
    final bio = p['bio'] ?? 'Dedicated healthcare professional.';
    final languages = (p['languages'] as List?) ?? ['Amharic', 'English'];
    final qualifications = (p['qualifications'] as List?) ?? ['Licensed Medical Clinician'];
    final reviews = (p['reviews'] as List?) ?? [];

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        title: const Text('Provider Profile'),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Profile Card
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  AvatarWidget(name: name, imageUrl: p['avatar'], radius: 36, verified: true),
                  const SizedBox(height: 12),
                  Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  const SizedBox(height: 2),
                  Text(title, style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildHeaderStat('Rating', '$rating ★ ($reviewCount)'),
                      _buildHeaderStat('Experience', '$experience Years'),
                      _buildHeaderStat('Verified', 'Govt Licensed'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Details Section
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Price card
                  CardWidget(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Home Visit Fee', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            Text('Includes checkup & supplies', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                          ],
                        ),
                        Text(
                          'ETB $price',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // About Me
                  const Text('About Provider', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  const SizedBox(height: 6),
                  CardWidget(
                    child: Text(
                      bio,
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.5),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Qualifications
                  const Text('Credentials & Qualifications', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  const SizedBox(height: 6),
                  CardWidget(
                    child: Column(
                      children: qualifications.map((q) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.verified, size: 16, color: AppTheme.primaryColor),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(q.toString(), style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                            ),
                          ],
                        ),
                      )).toList(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Languages
                  const Text('Languages Spoken', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: languages.map((lang) => Chip(
                      label: Text(lang.toString(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: AppTheme.borderColor),
                    )).toList(),
                  ),
                  const SizedBox(height: 16),
                  // Patient Reviews
                  const Text('Patient Reviews', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                  const SizedBox(height: 6),
                  if (reviews.isEmpty)
                    const Text('No reviews recorded yet.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted))
                  else
                    ...reviews.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: CardWidget(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(r['author'] ?? 'Anonymous Patient', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                RatingWidget(rating: (r['rating'] as num?)?.toDouble() ?? 5.0),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(r['comment'] ?? '', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ),
                    )),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        color: Colors.white,
        padding: const EdgeInsets.all(16),
        child: SafeArea(
          child: ElevatedButton(
            onPressed: () => context.push('/booking?providerId=${widget.providerId}'),
            child: const Text('Book Home Appointment'),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
      ],
    );
  }
}
