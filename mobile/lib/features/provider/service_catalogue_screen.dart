import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';

class ServiceCatalogueScreen extends ConsumerStatefulWidget {
  const ServiceCatalogueScreen({super.key});

  @override
  ConsumerState<ServiceCatalogueScreen> createState() => _ServiceCatalogueScreenState();
}

class _ServiceCatalogueScreenState extends ConsumerState<ServiceCatalogueScreen> {
  List<dynamic> _categories = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/services/categories');
      if (mounted) {
        setState(() {
          _categories = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _categories = [
            {'id': 'c1', 'title': 'General Care', 'description': 'Consultation & prescription', 'icon': '🩺'},
            {'id': 'c2', 'title': 'Physiotherapy', 'description': 'Recovery & exercises', 'icon': '💪'},
            {'id': 'c3', 'title': 'Nursing Visit', 'description': 'Injections & wound dressing', 'icon': '👩‍⚕️'},
            {'id': 'c4', 'title': 'Pediatrics', 'description': 'Care for kids & toddlers', 'icon': '👶'},
          ];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Service Catalogue')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(20.0),
              itemCount: _categories.length,
              itemBuilder: (context, idx) {
                final cat = _categories[idx];
                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: InkWell(
                    onTap: () {
                      context.push('/search-provider?specialty=${cat['title']}');
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Text(cat['icon'] ?? '🩺', style: const TextStyle(fontSize: 32)),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(cat['title'] ?? 'Care Category', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                const SizedBox(height: 4),
                                Text(cat['description'] ?? 'Specialty care visits.', style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 12)),
                              ],
                            ),
                          ),
                          Icon(Icons.arrow_forward_ios, size: 14, color: theme.primaryColor),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
