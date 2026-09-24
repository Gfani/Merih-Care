import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/theme/app_theme.dart';
import '../../core/network/network_providers.dart';
import '../../core/location/location_service.dart';
import '../../shared/widgets/spot_search_sheet.dart';
import '../../shared/widgets/custom_map_markers.dart';
import '../auth/auth_provider.dart';

class BookingScreen extends ConsumerStatefulWidget {
  final String providerId;

  const BookingScreen({super.key, required this.providerId});

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _notesController = TextEditingController();
  final _addressController = TextEditingController();

  late final MapController _mapController;
  double _patientLat = 9.0192;
  double _patientLon = 38.7578;
  final double _providerLat = 9.0315;
  final double _providerLon = 38.7660;

  List<LatLng> _routePoints = [];
  int _etaMinutes = 7;
  double _distanceKm = 2.1;
  bool _loadingRoute = false;

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String _selectedTime = '10:00 AM';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = ref.read(locationProvider).location;
      if (loc != null) {
        if (_addressController.text.isEmpty) {
          _addressController.text = loc.address;
        }
        _patientLat = loc.latitude;
        _patientLon = loc.longitude;
      }
      _fetchOsrmRoute();
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _fetchOsrmRoute() async {
    if (!mounted) return;
    setState(() => _loadingRoute = true);
    try {
      final client = ref.read(apiClientProvider);
      final url =
          'https://router.project-osrm.org/route/v1/driving/$_providerLon,$_providerLat;$_patientLon,$_patientLat?overview=full&geometries=geojson';
      final res = await client.dio.get(url);
      if (res.statusCode == 200 && res.data != null) {
        final routes = res.data['routes'] as List?;
        if (routes != null && routes.isNotEmpty) {
          final r = routes[0];
          final durationSec = (r['duration'] as num?)?.toDouble() ?? 0;
          final distMeters = (r['distance'] as num?)?.toDouble() ?? 0;
          final geom = r['geometry'] as Map<String, dynamic>?;
          final coords = geom?['coordinates'] as List?;
          if (coords != null) {
            final pts = coords.map((c) {
              final list = c as List;
              return LatLng((list[1] as num).toDouble(), (list[0] as num).toDouble());
            }).toList();

            if (mounted) {
              setState(() {
                _routePoints = pts;
                _etaMinutes = (durationSec / 60).round();
                if (_etaMinutes < 1) _etaMinutes = 1;
                _distanceKm = double.parse((distMeters / 1000).toStringAsFixed(1));
                _loadingRoute = false;
              });
              return;
            }
          }
        }
      }
    } catch (_) {
      // Graceful network fallback
    }

    if (mounted) {
      setState(() {
        _routePoints = [
          LatLng(_providerLat, _providerLon),
          LatLng(_patientLat, _patientLon),
        ];
        _loadingRoute = false;
      });
    }
  }

  Future<void> _moveToMyLocation() async {
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location services are disabled. Please enable GPS.')),
          );
        }
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permissions are denied.')),
          );
        }
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (!mounted) return;
      setState(() {
        _patientLat = position.latitude;
        _patientLon = position.longitude;
      });
      _mapController.move(LatLng(position.latitude, position.longitude), 15.0);
      _fetchOsrmRoute();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('📍 Map centered on your current location'),
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not retrieve current location: $e')),
        );
      }
    }
  }

  final List<String> _timeSlots = [
    '08:00 AM',
    '10:00 AM',
    '12:00 PM',
    '02:00 PM',
    '04:00 PM',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Schedule Care')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select Date', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 30)),
                  );
                  if (picked != null) {
                    setState(() => _selectedDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFE2E8EE)),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_selectedDate.year}-${_selectedDate.month}-${_selectedDate.day}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Icon(Icons.calendar_today, color: theme.primaryColor),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text('Select Time Slot', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                children: _timeSlots.map((time) {
                  final selected = _selectedTime == time;
                  return ChoiceChip(
                    label: Text(time),
                    selected: selected,
                    onSelected: (val) {
                      if (val) setState(() => _selectedTime = time);
                    },
                    selectedColor: theme.primaryColor,
                    labelStyle: TextStyle(color: selected ? Colors.white : Colors.black87),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Care Location Address', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextButton.icon(
                        onPressed: () {
                          SpotSearchSheet.show(
                            context,
                            ref,
                            initialQuery: _addressController.text,
                            onSpotSelected: (spot) {
                              setState(() {
                                _addressController.text = spot.address;
                                _patientLat = spot.latitude;
                                _patientLon = spot.longitude;
                              });
                              _mapController.move(LatLng(_patientLat, _patientLon), 14.5);
                              _fetchOsrmRoute();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('📍 Selected spot: ${spot.displaySpot}'),
                                  backgroundColor: theme.primaryColor,
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                          );
                        },
                        icon: const Icon(Icons.search, size: 16),
                        label: const Text('Search Spot', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                      const SizedBox(width: 4),
                      TextButton.icon(
                        onPressed: _moveToMyLocation,
                        icon: const Icon(Icons.my_location, size: 16),
                        label: const Text('Auto-Detect', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _addressController,
                decoration: InputDecoration(
                  labelText: 'Home / Visit Address',
                  hintText: 'e.g. Bole Medhanialem, Kazanchis, CMC...',
                  prefixIcon: const Icon(Icons.location_on_outlined, color: AppTheme.primaryColor),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.travel_explore, color: AppTheme.primaryColor),
                    tooltip: 'Search & Pick Spot',
                    onPressed: () {
                      SpotSearchSheet.show(
                        context,
                        ref,
                        initialQuery: _addressController.text,
                        onSpotSelected: (spot) {
                          setState(() {
                            _addressController.text = spot.address;
                            _patientLat = spot.latitude;
                            _patientLon = spot.longitude;
                          });
                          _mapController.move(LatLng(_patientLat, _patientLon), 14.5);
                          _fetchOsrmRoute();
                        },
                      );
                    },
                  ),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter location address';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Free OpenStreetMap Live Preview & OSRM Route Polyline
              Container(
                height: 210,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8EE)),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, 3)),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: LatLng(_patientLat, _patientLon),
                        initialZoom: 14.0,
                        onTap: (_, point) {
                          setState(() {
                            _patientLat = point.latitude;
                            _patientLon = point.longitude;
                          });
                          _fetchOsrmRoute();
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.merihcare.mobile',
                        ),
                        if (_routePoints.isNotEmpty)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _routePoints,
                                color: const Color(0xFF0D7C6A),
                                strokeWidth: 4.0,
                                borderColor: Colors.white,
                                borderStrokeWidth: 1.5,
                              ),
                            ],
                          ),
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: LatLng(_patientLat, _patientLon),
                              width: 80,
                              height: 64,
                              child: const PatientHomeMarker(label: 'Care Spot'),
                            ),
                            Marker(
                              point: LatLng(_providerLat, _providerLon),
                              width: 44,
                              height: 44,
                              child: const ClinicianMapMarker(isSelected: true),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Positioned(
                      top: 10,
                      left: 10,
                      child: FloatingEtaBadge(
                        etaText: '$_etaMinutes min transit',
                        distanceText: '$_distanceKm km',
                      ),
                    ),
                    if (_loadingRoute)
                      const Positioned(
                        top: 12,
                        right: 12,
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D7C6A)),
                        ),
                      ),
                    Positioned(
                      bottom: 10,
                      right: 10,
                      child: FloatingActionButton.small(
                        heroTag: 'booking_my_location_btn',
                        backgroundColor: Colors.white,
                        foregroundColor: theme.primaryColor,
                        tooltip: 'My Location',
                        onPressed: _moveToMyLocation,
                        child: const Icon(Icons.my_location, size: 20),
                      ),
                    ),
                    Positioned(
                      bottom: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          '© OpenStreetMap',
                          style: TextStyle(fontSize: 9, color: Colors.black54),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Patient Notes / Health History',
                  hintText: 'Add descriptions of symptoms, medicines or age info...',
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _submitting
                    ? null
                    : () async {
                        if (_formKey.currentState!.validate()) {
                          setState(() => _submitting = true);
                          try {
                            final client = ref.read(apiClientProvider);
                            final auth = ref.read(authProvider);
                            final user = auth.user;
                            final patientId = user?['id']?.toString();
                            final patientName = user?['name']?.toString() ??
                                (user?['email']?.toString().split('@')[0] ?? 'Patient');
                            final patientPhone = user?['phone']?.toString();

                            final m = _selectedDate.month.toString().padLeft(2, '0');
                            final d = _selectedDate.day.toString().padLeft(2, '0');
                            final dateStr = '${_selectedDate.year}-$m-$d';

                            final response = await client.dio.post('/appointments/book', data: {
                              'providerId': widget.providerId,
                              if (patientId != null && patientId.isNotEmpty && patientId != 'pat-user')
                                'patientId': patientId,
                              'patientName': patientName,
                              if (patientPhone != null && patientPhone.isNotEmpty)
                                'patientPhone': patientPhone,
                              'serviceId': 'doctor-visit',
                              'service': 'Doctor Home Visit',
                              'date': dateStr,
                              'time': _selectedTime,
                              'location': _addressController.text.trim(),
                              'address': _addressController.text.trim(),
                              'latitude': _patientLat,
                              'longitude': _patientLon,
                              'notes': _notesController.text.trim(),
                              'amount': 800.0,
                            });
                            setState(() => _submitting = false);
                            if (mounted) {
                              final apptId = response.data['id'] ?? 'appt-new';
                              context.replace('/payment?appointmentId=$apptId');
                            }
                          } catch (err) {
                            setState(() => _submitting = false);
                            print('[BOOKING] Error booking appointment: $err');
                            if (mounted) {
                              context.replace('/appointments');
                            }
                          }
                        }
                      },
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Proceed to Payment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
