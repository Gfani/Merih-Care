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
  bool _isGridView = false;

  final List<Map<String, dynamic>> _fallbackCategories = [
    {
      'id': 'cat-1',
      'title': 'Doctor Home Visit',
      'description': 'Comprehensive medical consultations, physical exams, and health assessments.',
      'icon': Icons.medical_services_outlined,
      'color': const Color(0xFFE6F5F2),
      'priceFrom': 800,
      'providerCount': 45,
    },
    {
      'id': 'cat-2',
      'title': 'Nursing Care',
      'description': 'Wound dressing, vital signs monitoring, IV therapy, and medication management.',
      'icon': Icons.favorite_border,
      'color': const Color(0xFFFEF3C7),
      'priceFrom': 450,
      'providerCount': 62,
    },
    {
      'id': 'cat-3',
      'title': 'Physiotherapy',
      'description': 'Post-stroke rehab, mobility exercises, musculoskeletal pain management.',
      'icon': Icons.directions_run,
      'color': const Color(0xFFE8F1FB),
      'priceFrom': 600,
      'providerCount': 28,
    },
    {
      'id': 'cat-4',
      'title': 'Elderly & Palliative Care',
      'description': 'Assistance with daily living activities, hygiene, and compassionate chronic care.',
      'icon': Icons.elderly_outlined,
      'color': const Color(0xFFF5E6FF),
      'priceFrom': 500,
      'providerCount': 34,
    },
    {
      'id': 'cat-5',
      'title': 'Lab Sample Collection',
      'description': 'Blood, urine, and swab collection at home with rapid lab dispatch.',
      'icon': Icons.science_outlined,
      'color': const Color(0xFFFEE2E2),
      'priceFrom': 350,
      'providerCount': 19,
    },
    {
      'id': 'cat-6',
      'title': 'Maternal & Newborn Care',
      'description': 'Postpartum support, infant wellness checks, and lactation guidance.',
      'icon': Icons.child_care_outlined,
      'color': const Color(0xFFFCE7F3),
      'priceFrom': 550,
      'providerCount': 22,
    },
    {
      'id': 'cat-7',
      'title': 'Medication & Pharmacy',
      'description': 'Prescription delivery, dosage management, and medication adherence support.',
      'icon': Icons.medication_outlined,
      'color': const Color(0xFFECFDF5),
      'priceFrom': 200,
      'providerCount': 40,
    },
    {
      'id': 'cat-8',
      'title': 'Post-Op Surgical Care',
      'description': 'Surgical incision monitoring, stitch removal, and postoperative recovery.',
      'icon': Icons.healing_outlined,
      'color': const Color(0xFFE0E7FF),
      'priceFrom': 700,
      'providerCount': 15,
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

  Map<String, dynamic> _normalizeCategory(dynamic c, int index) {
    final map = c is Map ? Map<String, dynamic>.from(c) : <String, dynamic>{};
    final title = map['title']?.toString() ?? map['name']?.toString() ?? 'Medical Service';
    final desc = map['description']?.toString() ?? 'Certified home health clinical service provided by licensed professionals.';
    final price = map['priceFrom'] ?? map['price'] ?? 500;
    final provCount = map['providerCount'] ?? map['count'] ?? 20;

    // Resolve IconData safely without typecast exceptions
    IconData iconData = Icons.medical_services_outlined;
    final rawIcon = map['icon'];
    if (rawIcon is IconData) {
      iconData = rawIcon;
    } else if (rawIcon is String) {
      final lower = rawIcon.toLowerCase();
      if (lower.contains('doctor') || lower.contains('medical') || lower.contains('activity')) {
        iconData = Icons.medical_services_outlined;
      } else if (lower.contains('nurse') || lower.contains('favorite') || lower.contains('heart')) {
        iconData = Icons.favorite_border;
      } else if (lower.contains('physio') || lower.contains('run') || lower.contains('walk')) {
        iconData = Icons.directions_run;
      } else if (lower.contains('elder') || lower.contains('senior')) {
        iconData = Icons.elderly_outlined;
      } else if (lower.contains('lab') || lower.contains('science') || lower.contains('test')) {
        iconData = Icons.science_outlined;
      } else if (lower.contains('maternal') || lower.contains('child') || lower.contains('baby')) {
        iconData = Icons.child_care_outlined;
      } else if (lower.contains('med') || lower.contains('pill') || lower.contains('pharmacy')) {
        iconData = Icons.medication_outlined;
      } else if (lower.contains('heal') || lower.contains('wound') || lower.contains('bandage')) {
        iconData = Icons.healing_outlined;
      }
    } else {
      final lowerTitle = title.toLowerCase();
      if (lowerTitle.contains('doctor')) {
        iconData = Icons.medical_services_outlined;
      } else if (lowerTitle.contains('nurs')) {
        iconData = Icons.favorite_border;
      } else if (lowerTitle.contains('physio')) {
        iconData = Icons.directions_run;
      } else if (lowerTitle.contains('elder')) {
        iconData = Icons.elderly_outlined;
      } else if (lowerTitle.contains('lab')) {
        iconData = Icons.science_outlined;
      } else if (lowerTitle.contains('matern') || lowerTitle.contains('pediatric')) {
        iconData = Icons.child_care_outlined;
      } else if (lowerTitle.contains('medic') || lowerTitle.contains('pharmacy')) {
        iconData = Icons.medication_outlined;
      } else if (lowerTitle.contains('post-op') || lowerTitle.contains('wound') || lowerTitle.contains('heal')) {
        iconData = Icons.healing_outlined;
      }
    }

    // Resolve Color safely
    final palette = [
      const Color(0xFFE6F5F2),
      const Color(0xFFFEF3C7),
      const Color(0xFFE8F1FB),
      const Color(0xFFF5E6FF),
      const Color(0xFFFEE2E2),
      const Color(0xFFFCE7F3),
      const Color(0xFFECFDF5),
      const Color(0xFFE0E7FF),
    ];
    Color bgCol = palette[index % palette.length];
    if (map['color'] is Color) {
      bgCol = map['color'] as Color;
    }

    return {
      'id': map['id']?.toString() ?? 'cat-$index',
      'title': title,
      'description': desc,
      'priceFrom': price,
      'providerCount': provCount,
      'icon': iconData,
      'color': bgCol,
    };
  }

  Future<void> _loadCategories() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/services/categories');
      final data = response.data;
      List rawList = [];
      if (data is List) {
        rawList = data;
      } else if (data is Map && data['data'] is List) {
        rawList = data['data'];
      } else if (data is Map && data['categories'] is List) {
        rawList = data['categories'];
      }

      if (rawList.isEmpty) {
        if (mounted) {
          setState(() {
            _categories = _fallbackCategories.asMap().entries.map((e) => _normalizeCategory(e.value, e.key)).toList();
            _loading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _categories = rawList.asMap().entries.map((e) => _normalizeCategory(e.value, e.key)).toList();
            _loading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _categories = _fallbackCategories.asMap().entries.map((e) => _normalizeCategory(e.value, e.key)).toList();
          _loading = false;
        });
      }
    }
  }

  void _showServiceDetail(Map<String, dynamic> cat) {
    final title = cat['title']?.toString() ?? 'Service';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXl)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
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
                      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text('${cat['providerCount'] ?? 20} verified clinicians ready', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      const SizedBox(height: 2),
                      Text('From ETB ${cat['priceFrom'] ?? 500} / visit', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Text('About this service', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 4),
            Text(
              cat['description']?.toString() ?? 'High-quality home healthcare service provided by verified professionals.',
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
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
            const SizedBox(height: 22),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/search-provider?specialty=${Uri.encodeComponent(title)}');
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMd)),
              ),
              child: Text('Find $title Providers', style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _categories.where((c) {
      final name = (c['title'] ?? '').toString().toLowerCase();
      final desc = (c['description'] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase()) || desc.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Services Catalogue'),
        actions: [
          IconButton(
            icon: Icon(_isGridView ? Icons.view_list_rounded : Icons.grid_view_rounded),
            tooltip: _isGridView ? 'Switch to List View' : 'Switch to Grid View',
            onPressed: () => setState(() => _isGridView = !_isGridView),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/dashboard');
              break;
            case 1:
              break;
            case 2:
              context.push('/appointments');
              break;
            case 3:
              context.push('/chat/apt-101');
              break;
            case 4:
              context.push('/profile-settings');
              break;
          }
        },
        backgroundColor: theme.brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 2,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: AppTheme.primaryColor), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.medical_services_outlined), selectedIcon: Icon(Icons.medical_services, color: AppTheme.primaryColor), label: 'Services'),
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today, color: AppTheme.primaryColor), label: 'Schedule'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble, color: AppTheme.primaryColor), label: 'Messages'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: AppTheme.primaryColor), label: 'Profile'),
        ],
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
                  : filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.search_off_rounded, size: 36, color: AppTheme.primaryColor),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _searchQuery.isNotEmpty
                                    ? 'No services matching "$_searchQuery"'
                                    : 'No services available at this time',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Try a different search keyword or browse all clinicians.',
                                style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primaryColor,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Clear Search Filter'),
                              ),
                            ],
                          ),
                        )
                      : _isGridView
                          ? GridView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                                childAspectRatio: 0.88,
                              ),
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final cat = filtered[index];
                                return InkWell(
                                  onTap: () => _showServiceDetail(cat),
                                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: theme.cardColor,
                                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                      border: Border.all(
                                        color: theme.brightness == Brightness.dark
                                            ? const Color(0xFF334155)
                                            : AppTheme.borderColor,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.03),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 44,
                                          height: 44,
                                          decoration: BoxDecoration(
                                            color: cat['color'] as Color? ?? AppTheme.primaryLight,
                                            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                                          ),
                                          child: Icon(
                                            cat['icon'] as IconData? ?? Icons.medical_services_outlined,
                                            size: 24,
                                            color: AppTheme.textPrimary,
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          cat['title']?.toString() ?? 'Service',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${cat['providerCount'] ?? 20} clinicians',
                                          style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'From ETB ${cat['priceFrom'] ?? 450}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.primaryColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
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
                                        child: Icon(
                                          cat['icon'] as IconData? ?? Icons.medical_services_outlined,
                                          size: 24,
                                          color: AppTheme.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              cat['title']?.toString() ?? 'Service',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              cat['description']?.toString() ?? '',
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
