import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/location/location_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/create_design_widgets.dart';

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

  final List<String> _specialties = [
    'All',
    'Doctor Visit',
    'Nursing Care',
    'Physiotherapy',
    'Elderly Care',
    'Lab Tests',
    'Maternal Care',
  ];

  @override
  void initState() {
    super.initState();
    _selectedSpecialty = widget.specialty ?? 'All';
    _loadProviders();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProviders() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers', queryParameters: {
        if (_selectedSpecialty != null && _selectedSpecialty != 'All') 'specialty': _selectedSpecialty,
        'search': _searchController.text.trim(),
      });
      if (mounted) {
        final dynamic raw = response.data;
        final List list = raw is List ? raw : (raw is Map && raw['data'] is List ? raw['data'] : []);
        setState(() {
          _providers = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _providers = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationState = ref.watch(locationProvider);
    final filtered = _providers.where((p) {
      final name = (p['name'] ?? p['user']?['name'] ?? '').toString().toLowerCase();
      final specialty = (p['specialty'] ?? p['title'] ?? '').toString().toLowerCase();
      final query = _searchController.text.trim().toLowerCase();
      final matchesSearch = query.isEmpty || name.contains(query) || specialty.contains(query);
      final rating = (p['rating'] as num?)?.toDouble() ?? 4.5;
      final matchesRating = rating >= _minRating;
      return matchesSearch && matchesRating;
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        title: const Text('Available Healthcare Providers'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // GPS Location Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.white,
              child: Row(
                children: [
                  const Icon(Icons.my_location, size: 16, color: AppTheme.primaryColor),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      locationState.location?.fullAddress ?? 'Bole, Addis Ababa (Near You)',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                    ),
                  ),
                  InkWell(
                    onTap: () => ref.read(locationProvider.notifier).autoDetectCurrentLocation(),
                    child: Text(
                      locationState.isDetecting ? 'Detecting...' : 'Update GPS',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppTheme.borderColor),
            // Search Input & Filter Chips
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search by provider name or specialty...',
                      prefixIcon: const Icon(Icons.search, color: AppTheme.textMuted),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                setState(() {});
                              },
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 34,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _specialties.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 6),
                      itemBuilder: (context, idx) {
                        final spec = _specialties[idx];
                        final isSelected = _selectedSpecialty == spec;
                        return ChoiceChip(
                          label: Text(spec, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.bold : FontWeight.w500, color: isSelected ? Colors.white : AppTheme.textSecondary)),
                          selected: isSelected,
                          selectedColor: AppTheme.primaryColor,
                          backgroundColor: AppTheme.surfaceColor,
                          side: BorderSide(color: isSelected ? AppTheme.primaryColor : AppTheme.borderColor),
                          onSelected: (selected) {
                            if (selected) {
                              setState(() => _selectedSpecialty = spec);
                              _loadProviders();
                            }
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Provider Results Count
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${filtered.length} verified providers near you',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
            // Provider List
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                      ? const Center(
                          child: Text('No providers found matching your criteria.', style: TextStyle(color: AppTheme.textMuted)),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final provider = filtered[index];
                            final name = provider['name'] ?? provider['user']?['name'] ?? 'Provider';
                            return ProviderCardWidget(
                              provider: {
                                ...provider,
                                'name': name,
                              },
                              onTap: () => context.push('/provider/${provider['id']}'),
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
