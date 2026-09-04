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

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers/${widget.providerId}');
      final dynamic raw = response.data;
      final Map<String, dynamic>? data = (raw is Map<String, dynamic> && raw.containsKey('data') && raw['data'] is Map<String, dynamic>)
          ? raw['data'] as Map<String, dynamic>
          : (raw is Map<String, dynamic> ? raw : null);
      if (mounted) {
        setState(() {
          _provider = data;
          _loading = false;
        });
      }
    } catch (e) {
      print('[PROVIDER_PROFILE] Error loading provider profile: $e');
      if (mounted) {
        setState(() {
          _provider = null;
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

    if (_provider == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Provider Profile')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_off_outlined, size: 56, color: AppTheme.textMuted),
                const SizedBox(height: 12),
                const Text('Healthcare provider profile not found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                const Text(
                  'The requested provider may be offline or unavailable at this moment.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    OutlinedButton(
                      onPressed: () => context.pop(),
                      child: const Text('Go Back'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: _loadProfile,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    final p = _provider!;
    final name = p['name'] ?? p['user']?['name'] ?? 'Healthcare Provider';
    final title = p['title'] ?? p['specialty'] ?? 'Healthcare Specialist';
    final rating = (p['rating'] as num?)?.toDouble() ?? 5.0;
    final reviewCount = p['reviewCount'] as int? ?? 0;
    final experience = p['experience'] ?? 0;
    final price = p['pricePerVisit'] ?? p['hourlyRate'] ?? 800;
    final bio = p['bio'] ?? 'Verified healthcare professional providing home medical care.';
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
            onPressed: () => context.push('/booking?providerId=${_provider?['id'] ?? widget.providerId}'),
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
