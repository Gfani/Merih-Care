import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';

class ProviderSearchScreen extends ConsumerStatefulWidget {
  final String? specialty;

  const ProviderSearchScreen({super.key, this.specialty});

  @override
  ConsumerState<ProviderSearchScreen> createState() => _ProviderSearchScreenState();
}

class _ProviderSearchScreenState extends ConsumerState<ProviderSearchScreen> {
  final _searchController = TextEditingController();
  List<dynamic> _providers = [];
  bool _loading = true;
  String? _selectedSpecialty;
  double _minRating = 0.0;

  @override
  void initState() {
    super.initState();
    _selectedSpecialty = widget.specialty;
    _loadProviders();
  }

  Future<void> _loadProviders() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers', queryParameters: {
        if (_selectedSpecialty != null) 'specialty': _selectedSpecialty,
        'search': _searchController.text.trim(),
      });
      if (mounted) {
        setState(() {
          _providers = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _providers = [
            {
              'id': 'p-201',
              'user': {'name': 'Dr. Meron Alemu'},
              'specialty': 'General Care',
              'rating': 4.9,
              'experience': 8,
              'hourlyRate': 250,
              'avatarUrl': null,
              'bio': 'Experienced practitioner offering care for all ages.',
            },
            {
              'id': 'p-202',
              'user': {'name': 'Nurse Bereket Solomon'},
              'specialty': 'Nursing Visit',
              'rating': 4.7,
              'experience': 5,
              'hourlyRate': 180,
              'avatarUrl': null,
              'bio': 'Specialized home care, wounds treatment, and IV procedures.',
            }
          ];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _providers.where((p) => (p['rating'] as num).toDouble() >= _minRating).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.specialty ?? 'Search Providers'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by name...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _loadProviders();
                        },
                      ),
                    ),
                    onSubmitted: (_) => _loadProviders(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: Icon(Icons.tune, color: theme.primaryColor),
                  onPressed: _showFilterModal,
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? const Center(child: Text('No providers found.'))
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        itemCount: filtered.length,
                        itemBuilder: (context, idx) {
                          final prov = filtered[idx];
                          final user = prov['user'] ?? {};
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: theme.primaryColor.withOpacity(0.1),
                                child: Text(user['name']?[0]?.toUpperCase() ?? 'P'),
                              ),
                              title: Text(user['name'] ?? 'Doctor Name', style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${prov['specialty']} • ${prov['experience']} years exp'),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.star, color: Colors.amber, size: 16),
                                      const SizedBox(width: 4),
                                      Text(prov['rating'].toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: Text('ETB ${prov['hourlyRate']}/hr', style: TextStyle(fontWeight: FontWeight.bold, color: theme.primaryColor)),
                              onTap: () => context.push('/provider/${prov['id']}'),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  void _showFilterModal() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Filter Providers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  const Text('Minimum Rating', style: TextStyle(fontWeight: FontWeight.w600)),
                  Slider(
                    value: _minRating,
                    min: 0.0,
                    max: 5.0,
                    divisions: 5,
                    label: _minRating.toString(),
                    onChanged: (val) {
                      setModalState(() => _minRating = val);
                      setState(() {});
                    },
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _loadProviders();
                    },
                    child: const Text('Apply Filters'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
