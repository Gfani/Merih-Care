import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/location/location_service.dart';
import '../../core/theme/app_theme.dart';

class SpotSearchSheet extends ConsumerStatefulWidget {
  final Function(LocationDataModel selectedSpot) onSpotSelected;
  final String? initialQuery;

  const SpotSearchSheet({
    super.key,
    required this.onSpotSelected,
    this.initialQuery,
  });

  static Future<LocationDataModel?> show(
    BuildContext context,
    WidgetRef ref, {
    Function(LocationDataModel selectedSpot)? onSpotSelected,
    String? initialQuery,
  }) {
    return showModalBottomSheet<LocationDataModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SpotSearchSheet(
        initialQuery: initialQuery,
        onSpotSelected: (spot) {
          if (onSpotSelected != null) {
            onSpotSelected(spot);
          }
          Navigator.of(ctx).pop(spot);
        },
      ),
    );
  }

  @override
  ConsumerState<SpotSearchSheet> createState() => _SpotSearchSheetState();
}

class _SpotSearchSheetState extends ConsumerState<SpotSearchSheet> {
  final TextEditingController _searchController = TextEditingController();
  List<LocationDataModel> _results = [];
  bool _isDetecting = false;

  final List<String> _popularLandmarks = [
    'Bole Medhanialem',
    'Edna Mall',
    'Kazanchis',
    'Sarbet',
    'Megenagna',
    'CMC Michael',
    'Mexico Square',
    'Piassa',
    'Bisrate Gabriel',
    'Ayat',
    'Jemo 1',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _searchController.text = widget.initialQuery!;
    }
    _runSearch(_searchController.text);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _runSearch(String query) {
    final spots = ref.read(locationProvider.notifier).searchSpots(query);
    setState(() {
      _results = spots;
    });
  }

  Future<void> _handleAutoDetect() async {
    setState(() => _isDetecting = true);
    try {
      final detected = await ref.read(locationProvider.notifier).autoDetectCurrentLocation();
      if (detected != null && mounted) {
        widget.onSpotSelected(detected);
      }
    } finally {
      if (mounted) setState(() => _isDetecting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Choose Care Location',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Identify landmark, neighborhood, or home spot',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: TextField(
              controller: _searchController,
              autofocus: false,
              onChanged: _runSearch,
              decoration: InputDecoration(
                hintText: 'Search spot (e.g. Bole Medhanialem, Kazanchis...)',
                prefixIcon: const Icon(Icons.search, color: AppTheme.primaryColor),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _runSearch('');
                        },
                      )
                    : null,
                filled: true,
                fillColor: const Color(0xFFF3F6F9),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),

          // Auto-detect GPS button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: InkWell(
              onTap: _isDetecting ? null : _handleAutoDetect,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primaryColor.withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    _isDetecting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryColor),
                          )
                        : const Icon(Icons.my_location, color: AppTheme.primaryColor, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isDetecting ? 'Detecting nearest spot...' : 'Auto-Detect Current GPS Spot',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: AppTheme.primaryColor,
                            ),
                          ),
                          Text(
                            'Identifies the closest landmark and sets human-readable address',
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppTheme.primaryColor, size: 18),
                  ],
                ),
              ),
            ),
          ),

          // Quick Landmark Chips
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: _popularLandmarks.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final landmark = _popularLandmarks[index];
                return ActionChip(
                  label: Text(landmark),
                  labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  backgroundColor: const Color(0xFFF1F4F8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  onPressed: () {
                    _searchController.text = landmark;
                    _runSearch(landmark);
                  },
                );
              },
            ),
          ),

          const Divider(height: 16),

          // Search Results
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.location_off_outlined, size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          Text(
                            'No landmarks found for "${_searchController.text}"',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'You can use this custom query directly as your address.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                          const SizedBox(height: 16),
                          if (_searchController.text.trim().isNotEmpty)
                            ElevatedButton.icon(
                              onPressed: () {
                                final customSpot = LocationDataModel(
                                  latitude: 9.0054,
                                  longitude: 38.7845,
                                  address: '${_searchController.text.trim()}, Addis Ababa',
                                  spotName: _searchController.text.trim(),
                                  subCity: 'Addis Ababa',
                                  city: 'Addis Ababa',
                                  timestamp: DateTime.now(),
                                );
                                ref.read(locationProvider.notifier).selectSpot(customSpot);
                                widget.onSpotSelected(customSpot);
                              },
                              icon: const Icon(Icons.check, size: 18),
                              label: Text('Use "${_searchController.text.trim()}"'),
                            ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    itemCount: _results.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFEEEEEE)),
                    itemBuilder: (context, index) {
                      final spot = _results[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        leading: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryColor.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.location_pin, color: AppTheme.primaryColor, size: 22),
                        ),
                        title: Text(
                          spot.spotName.isNotEmpty ? spot.spotName : spot.address,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        subtitle: Text(
                          spot.address,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            spot.subCity,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey.shade700),
                          ),
                        ),
                        onTap: () {
                          ref.read(locationProvider.notifier).selectSpot(spot);
                          widget.onSpotSelected(spot);
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
