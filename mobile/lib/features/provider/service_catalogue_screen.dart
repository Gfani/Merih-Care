import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/create_design_widgets.dart';

class ServiceCatalogueScreen extends ConsumerStatefulWidget {
  const ServiceCatalogueScreen({super.key});

  @override
  ConsumerState<ServiceCatalogueScreen> createState() => _ServiceCatalogueScreenState();
}

class _ServiceCatalogueScreenState extends ConsumerState<ServiceCatalogueScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _categories = [];
  String _searchQuery = '';
  bool _loading = true;

  final List<Map<String, dynamic>> _fallbackCategories = [
    {
      'id': 'cat-1',
      'title': 'Doctor Home Visit',
      'description': 'Comprehensive medical consultations, physical exams, and health assessments.',
      'icon': Icons.medical_services_outlined,
      'color': Color(0xFFE6F5F2),
      'priceFrom': 800,
      'providerCount': 45,
    },
    {
      'id': 'cat-2',
      'title': 'Nursing Care',
      'description': 'Wound dressing, vital signs monitoring, IV therapy, and medication management.',
      'icon': Icons.favorite_border,
      'color': Color(0xFFFEF3C7),
      'priceFrom': 450,
      'providerCount': 62,
    },
    {
      'id': 'cat-3',
      'title': 'Physiotherapy',
      'description': 'Post-stroke rehab, mobility exercises, musculoskeletal pain management.',
      'icon': Icons.directions_run,
      'color': Color(0xFFE8F1FB),
      'priceFrom': 600,
      'providerCount': 28,
    },
    {
      'id': 'cat-4',
      'title': 'Elderly & Palliative Care',
      'description': 'Assistance with daily living activities, hygiene, and compassionate chronic care.',
      'icon': Icons.elderly_outlined,
      'color': Color(0xFFF5E6FF),
      'priceFrom': 500,
      'providerCount': 34,
    },
    {
      'id': 'cat-5',
      'title': 'Lab Sample Collection',
      'description': 'Blood, urine, and swab collection at home with rapid lab dispatch.',
      'icon': Icons.science_outlined,
      'color': Color(0xFFFEE2E2),
      'priceFrom': 350,
      'providerCount': 19,
    },
    {
      'id': 'cat-6',
      'title': 'Maternal & Newborn Care',
      'description': 'Postpartum support, infant wellness checks, and lactation guidance.',
      'icon': Icons.child_care_outlined,
      'color': Color(0xFFFCE7F3),
      'priceFrom': 550,
      'providerCount': 22,
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/services/categories');
      if (mounted) {
        setState(() {
          _categories = (response.data as List).map((c) => Map<String, dynamic>.from(c)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _categories = _fallbackCategories;
          _loading = false;
        });
      }
    }
  }

  void _showServiceDetail(Map<String, dynamic> cat) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: cat['color'] as Color? ?? AppTheme.primaryLight,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  child: Icon(cat['icon'] as IconData? ?? Icons.medical_services_outlined, size: 28, color: AppTheme.textPrimary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(cat['title'] ?? 'Service', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text('${cat['providerCount'] ?? 20} verified providers', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      Text('From ETB ${cat['priceFrom'] ?? 500} / visit', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('About this service', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 4),
            Text(
              cat['description'] ?? 'High-quality home healthcare service provided by verified professionals.',
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 14),
            const Text('What\'s included', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            ...[
              'Initial assessment and vital signs check',
              'Personalized clinical care plan',
              'All necessary disposable medical supplies',
              'Digital care summary and prescriptions',
              'Direct follow-up messaging with provider'
            ].map((inc) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, size: 16, color: AppTheme.primaryColor),
                  const SizedBox(width: 8),
                  Text(inc, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                ],
              ),
            )),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/search-provider?specialty=${Uri.encodeComponent(cat['title'])}');
              },
              child: Text('Find ${cat['title']} Providers'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _categories.where((c) {
      final name = (c['title'] ?? '').toString().toLowerCase();
      final desc = (c['description'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase()) || desc.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        title: const Text('Services Catalogue'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search medical services...',
                      prefixIcon: const Icon(Icons.search, color: AppTheme.textMuted),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/search-provider'),
                    icon: const Icon(Icons.people_outline, size: 16),
                    label: const Text('Browse All Providers Directly'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(40),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final cat = filtered[index];
                        return CardWidget(
                          onTap: () => _showServiceDetail(cat),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: cat['color'] as Color? ?? AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                ),
                                child: Icon(cat['icon'] as IconData? ?? Icons.medical_services_outlined, size: 24, color: AppTheme.textPrimary),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      cat['title'] ?? 'Service',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      cat['description'] ?? '',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Text(
                                          '${cat['providerCount'] ?? 20} providers',
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                                        ),
                                        const SizedBox(width: 10),
                                        Text(
                                          'From ETB ${cat['priceFrom'] ?? 450}',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.borderStrong),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
