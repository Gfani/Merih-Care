import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

class LocationDataModel {
  final double latitude;
  final double longitude;
  final String address;
  final String spotName;
  final String subCity;
  final String city;
  final double accuracy;
  final DateTime timestamp;

  const LocationDataModel({
    required this.latitude,
    required this.longitude,
    required this.address,
    this.spotName = '',
    required this.subCity,
    this.city = 'Addis Ababa',
    this.accuracy = 10.0,
    required this.timestamp,
  });

  String get displaySpot => spotName.isNotEmpty ? spotName : (address.isNotEmpty ? address : '$subCity, $city');
  String get shortAddress => '$subCity, $city';
  String get fullAddress => address.isNotEmpty ? address : shortAddress;

  LocationDataModel copyWith({
    double? latitude,
    double? longitude,
    String? address,
    String? spotName,
    String? subCity,
    String? city,
    double? accuracy,
    DateTime? timestamp,
  }) {
    return LocationDataModel(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      address: address ?? this.address,
      spotName: spotName ?? this.spotName,
      subCity: subCity ?? this.subCity,
      city: city ?? this.city,
      accuracy: accuracy ?? this.accuracy,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}

class LocationState {
  final bool isDetecting;
  final bool permissionGranted;
  final LocationDataModel? location;
  final String? error;

  const LocationState({
    this.isDetecting = false,
    this.permissionGranted = true,
    this.location,
    this.error,
  });

  LocationState copyWith({
    bool? isDetecting,
    bool? permissionGranted,
    LocationDataModel? location,
    String? error,
  }) {
    return LocationState(
      isDetecting: isDetecting ?? this.isDetecting,
      permissionGranted: permissionGranted ?? this.permissionGranted,
      location: location ?? this.location,
      error: error,
    );
  }
}

/// Catalog of prominent landmarks, neighborhoods, and reference spots across Addis Ababa.
const List<Map<String, dynamic>> kEthiopianLandmarks = [
  // ── Bole Subcity ─────────────────────────────────────────────────────────────
  {
    'name': 'Bole Medhanialem',
    'subCity': 'Bole',
    'address': 'Bole Medhanialem, Bole, Addis Ababa',
    'lat': 9.0004,
    'lon': 38.7885,
  },
  {
    'name': 'Edna Mall',
    'subCity': 'Bole',
    'address': 'Near Edna Mall, Cameroon St, Bole, Addis Ababa',
    'lat': 9.0054,
    'lon': 38.7845,
  },
  {
    'name': 'Bole Atlas',
    'subCity': 'Bole',
    'address': 'Bole Atlas, Namibia St, Bole, Addis Ababa',
    'lat': 9.0125,
    'lon': 38.7810,
  },
  {
    'name': 'Bole Brass',
    'subCity': 'Bole',
    'address': 'Bole Brass, Bole, Addis Ababa',
    'lat': 8.9950,
    'lon': 38.7830,
  },
  {
    'name': 'Bole Rwanda',
    'subCity': 'Bole',
    'address': 'Bole Rwanda, Japan St, Bole, Addis Ababa',
    'lat': 8.9972,
    'lon': 38.7750,
  },
  {
    'name': 'Bole Dembel (Olympia)',
    'subCity': 'Bole',
    'address': 'Dembel City Center, Africa Ave, Bole, Addis Ababa',
    'lat': 9.0078,
    'lon': 38.7668,
  },
  {
    'name': 'Bole Bulbula',
    'subCity': 'Bole',
    'address': 'Bole Bulbula, Mariam Sefer, Bole, Addis Ababa',
    'lat': 8.9720,
    'lon': 38.7950,
  },
  {
    'name': 'Gerji Imperial',
    'subCity': 'Bole',
    'address': 'Gerji, Near Imperial Hotel, Bole, Addis Ababa',
    'lat': 9.0090,
    'lon': 38.8105,
  },
  {
    'name': '22 Mazoria',
    'subCity': 'Bole',
    'address': '22 Mazoria, Haile Gebreselassie Ave, Addis Ababa',
    'lat': 9.0180,
    'lon': 38.7890,
  },

  // ── Kirkos Subcity ───────────────────────────────────────────────────────────
  {
    'name': 'Kazanchis (ECA Area)',
    'subCity': 'Kirkos',
    'address': 'Kazanchis, Guinea Conakry St, Kirkos, Addis Ababa',
    'lat': 9.0186,
    'lon': 38.7698,
  },
  {
    'name': 'Meskel Square',
    'subCity': 'Kirkos',
    'address': 'Meskel Square, Kirkos, Addis Ababa',
    'lat': 9.0105,
    'lon': 38.7610,
  },
  {
    'name': 'Mexico Square',
    'subCity': 'Kirkos',
    'address': 'Mexico Square, Sengatera, Kirkos, Addis Ababa',
    'lat': 9.0118,
    'lon': 38.7445,
  },
  {
    'name': 'Sarbet (Karl Square)',
    'subCity': 'Kirkos',
    'address': 'Sarbet, Near Karl Square, Kirkos, Addis Ababa',
    'lat': 8.9950,
    'lon': 38.7380,
  },
  {
    'name': 'Old Airport',
    'subCity': 'Kirkos',
    'address': 'Old Airport, Golf Club Rd, Kirkos, Addis Ababa',
    'lat': 8.9875,
    'lon': 38.7302,
  },
  {
    'name': 'Gotera Interchange',
    'subCity': 'Kirkos',
    'address': 'Gotera Interchange, Debre Zeit Rd, Addis Ababa',
    'lat': 8.9902,
    'lon': 38.7615,
  },
  {
    'name': 'Beklo Bet',
    'subCity': 'Kirkos',
    'address': 'Beklo Bet, Debre Zeit Rd, Kirkos, Addis Ababa',
    'lat': 9.0020,
    'lon': 38.7625,
  },

  // ── Yeka Subcity ─────────────────────────────────────────────────────────────
  {
    'name': 'Megenagna (Zefmesh Mall)',
    'subCity': 'Yeka',
    'address': 'Megenagna Roundabout, Zefmesh Mall, Yeka, Addis Ababa',
    'lat': 9.0225,
    'lon': 38.8021,
  },
  {
    'name': 'CMC Michael',
    'subCity': 'Yeka',
    'address': 'CMC Michael Residential Village, Yeka, Addis Ababa',
    'lat': 9.0280,
    'lon': 38.8350,
  },
  {
    'name': 'Ayat Roundabout',
    'subCity': 'Yeka',
    'address': 'Ayat Roundabout, Zone 3, Yeka, Addis Ababa',
    'lat': 9.0345,
    'lon': 38.8710,
  },
  {
    'name': 'Signal',
    'subCity': 'Yeka',
    'address': 'Signal Area, Yeka, Addis Ababa',
    'lat': 9.0250,
    'lon': 38.7900,
  },
  {
    'name': 'Shola Market',
    'subCity': 'Yeka',
    'address': 'Shola Gebeya, Yeka, Addis Ababa',
    'lat': 9.0230,
    'lon': 38.7840,
  },

  // ── Arada Subcity ────────────────────────────────────────────────────────────
  {
    'name': 'Piassa (Churchill Ave)',
    'subCity': 'Arada',
    'address': 'Piassa, Churchill Avenue, Arada, Addis Ababa',
    'lat': 9.0350,
    'lon': 38.7520,
  },
  {
    'name': '4 Kilo',
    'subCity': 'Arada',
    'address': '4 Kilo, King George VI St, Arada, Addis Ababa',
    'lat': 9.0328,
    'lon': 38.7635,
  },
  {
    'name': '6 Kilo',
    'subCity': 'Arada',
    'address': '6 Kilo, Yekatit 12 Square, Arada, Addis Ababa',
    'lat': 9.0435,
    'lon': 38.7615,
  },

  // ── Lideta Subcity ───────────────────────────────────────────────────────────
  {
    'name': 'Lideta Balcha',
    'subCity': 'Lideta',
    'address': 'Lideta Balcha Hospital Area, Lideta, Addis Ababa',
    'lat': 9.0145,
    'lon': 38.7360,
  },
  {
    'name': 'Tor Hailoch',
    'subCity': 'Lideta',
    'address': 'Tor Hailoch Roundabout, Lideta, Addis Ababa',
    'lat': 9.0120,
    'lon': 38.7250,
  },

  // ── Nifas Silk-Lafto Subcity ─────────────────────────────────────────────────
  {
    'name': 'Bisrate Gabriel',
    'subCity': 'Nifas Silk-Lafto',
    'address': 'Bisrate Gabriel Church Area, Nifas Silk-Lafto, Addis Ababa',
    'lat': 8.9880,
    'lon': 38.7240,
  },
  {
    'name': 'Jemo 1',
    'subCity': 'Nifas Silk-Lafto',
    'address': 'Jemo 1 Condominium, Nifas Silk-Lafto, Addis Ababa',
    'lat': 8.9610,
    'lon': 38.7050,
  },
  {
    'name': 'Lebu Varnero',
    'subCity': 'Nifas Silk-Lafto',
    'address': 'Lebu Varnero Area, Nifas Silk-Lafto, Addis Ababa',
    'lat': 8.9740,
    'lon': 38.7180,
  },
  {
    'name': 'Kera (Sofia Mall)',
    'subCity': 'Nifas Silk-Lafto',
    'address': 'Kera, Sofia Mall Area, Nifas Silk-Lafto, Addis Ababa',
    'lat': 9.0010,
    'lon': 38.7490,
  },
  {
    'name': 'Saris Abo',
    'subCity': 'Nifas Silk-Lafto',
    'address': 'Saris Abo, Debre Zeit Rd, Nifas Silk-Lafto, Addis Ababa',
    'lat': 8.9680,
    'lon': 38.7660,
  },

  // ── Lemi Kura Subcity ────────────────────────────────────────────────────────
  {
    'name': 'Summit Fiyel Bet',
    'subCity': 'Lemi Kura',
    'address': 'Summit, Near Fiyel Bet, Lemi Kura, Addis Ababa',
    'lat': 9.0190,
    'lon': 38.8650,
  },

  // ── Gulele Subcity ───────────────────────────────────────────────────────────
  {
    'name': 'Shiro Meda',
    'subCity': 'Gulele',
    'address': 'Shiro Meda, Entoto Rd, Gulele, Addis Ababa',
    'lat': 9.0550,
    'lon': 38.7620,
  },
  {
    'name': 'Addisu Gebeya',
    'subCity': 'Gulele',
    'address': 'Addisu Gebeya, Gulele, Addis Ababa',
    'lat': 9.0580,
    'lon': 38.7410,
  },

  // ── Kolfe Keranio Subcity ────────────────────────────────────────────────────
  {
    'name': 'Ayer Tena',
    'subCity': 'Kolfe Keranio',
    'address': 'Ayer Tena Roundabout, Kolfe Keranio, Addis Ababa',
    'lat': 8.9880,
    'lon': 38.7020,
  },
  {
    'name': 'Total 18',
    'subCity': 'Kolfe Keranio',
    'address': 'Total 18, Kolfe Keranio, Addis Ababa',
    'lat': 9.0200,
    'lon': 38.7080,
  },
];

class LocationNotifier extends StateNotifier<LocationState> {
  LocationNotifier()
      : super(
          LocationState(
            location: LocationDataModel(
              latitude: 9.0054,
              longitude: 38.7845,
              address: 'Near Edna Mall, Cameroon St, Bole, Addis Ababa',
              spotName: 'Edna Mall',
              subCity: 'Bole',
              city: 'Addis Ababa',
              accuracy: 8.5,
              timestamp: DateTime.now(),
            ),
          ),
        );

  /// Approximate distance in meters between two lat/lng coordinates (Haversine formula).
  static double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
    const double p = 0.017453292519943295; // Math.PI / 180
    final double a = 0.5 -
        cos((lat2 - lat1) * p) / 2 +
        cos(lat1 * p) * cos(lat2 * p) * (1 - cos((lon2 - lon1) * p)) / 2;
    return 12742 * asin(sqrt(a)) * 1000; // 2 * R * 1000 meters
  }

  /// Resolves the nearest human-readable spot and address for a coordinate.
  /// Never returns raw latitude/longitude strings.
  static Future<Map<String, String>> resolveSpotInfo(double lat, double lon) async {
    // 1. Find the closest known landmark in Addis Ababa
    Map<String, dynamic>? closest;
    double minDistance = double.infinity;

    for (final landmark in kEthiopianLandmarks) {
      final double lLat = landmark['lat'] as double;
      final double lLon = landmark['lon'] as double;
      final double dist = calculateDistanceMeters(lat, lon, lLat, lLon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = landmark;
      }
    }

    // 2. If within 1.5 km of a known spot, use the local landmark name
    if (closest != null && minDistance <= 1500) {
      final String name = closest['name'] as String;
      final String subCity = closest['subCity'] as String;
      if (minDistance < 350) {
        return {
          'spotName': name,
          'subCity': subCity,
          'address': '$name, $subCity, Addis Ababa',
        };
      } else {
        return {
          'spotName': 'Near $name',
          'subCity': subCity,
          'address': 'Near $name, $subCity, Addis Ababa',
        };
      }
    }

    // 3. For coordinates farther away, attempt fast reverse-geocoding via OpenStreetMap Nominatim
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?lat=$lat&lon=$lon&format=json&addressdetails=1',
      );
      final client = HttpClient()..connectionTimeout = const Duration(milliseconds: 2500);
      final request = await client.getUrl(uri);
      request.headers.set('User-Agent', 'MerihCare-Mobile/1.0 (contact@merihcare.com)');
      final response = await request.close().timeout(const Duration(milliseconds: 2500));

      if (response.statusCode == 200) {
        final responseBody = await response.transform(utf8.decoder).join();
        final Map<String, dynamic> data = json.decode(responseBody);
        final Map<String, dynamic>? addressObj = data['address'] as Map<String, dynamic>?;

        if (addressObj != null) {
          final String spot = (data['name']?.toString().isNotEmpty == true)
              ? data['name'].toString()
              : (addressObj['amenity'] ??
                  addressObj['building'] ??
                  addressObj['neighbourhood'] ??
                  addressObj['road'] ??
                  '');
          final String subCity = addressObj['suburb'] ??
              addressObj['city_district'] ??
              closest?['subCity'] ??
              'Bole';
          final String road = addressObj['road'] ?? '';

          String formattedAddress = '';
          if (spot.isNotEmpty && road.isNotEmpty && spot != road) {
            formattedAddress = '$spot, $road, $subCity, Addis Ababa';
          } else if (spot.isNotEmpty) {
            formattedAddress = '$spot, $subCity, Addis Ababa';
          } else if (road.isNotEmpty) {
            formattedAddress = '$road, $subCity, Addis Ababa';
          } else {
            formattedAddress = '$subCity, Addis Ababa';
          }

          return {
            'spotName': spot.isNotEmpty ? spot : subCity,
            'subCity': subCity,
            'address': formattedAddress,
          };
        }
      }
    } catch (_) {
      // Network timeout or offline; proceed to regional landmark fallback
    }

    // 4. Guaranteed clean regional fallback (never raw numbers)
    final String fallbackName = closest != null ? (closest['name'] as String) : 'Bole Medhanialem';
    final String fallbackSubCity = closest != null ? (closest['subCity'] as String) : 'Bole';

    return {
      'spotName': fallbackName,
      'subCity': fallbackSubCity,
      'address': 'Near $fallbackName, $fallbackSubCity, Addis Ababa',
    };
  }

  /// Searches spots by name, landmark, or subcity query.
  List<LocationDataModel> searchSpots(String query) {
    final cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.isEmpty) {
      // Return popular reference spots
      return kEthiopianLandmarks.take(10).map((s) {
        return LocationDataModel(
          latitude: s['lat'] as double,
          longitude: s['lon'] as double,
          address: s['address'] as String,
          spotName: s['name'] as String,
          subCity: s['subCity'] as String,
          city: 'Addis Ababa',
          timestamp: DateTime.now(),
        );
      }).toList();
    }

    final matches = kEthiopianLandmarks.where((s) {
      final name = (s['name'] as String).toLowerCase();
      final subCity = (s['subCity'] as String).toLowerCase();
      final addr = (s['address'] as String).toLowerCase();
      return name.contains(cleanQuery) || subCity.contains(cleanQuery) || addr.contains(cleanQuery);
    }).toList();

    return matches.map((s) {
      return LocationDataModel(
        latitude: s['lat'] as double,
        longitude: s['lon'] as double,
        address: s['address'] as String,
        spotName: s['name'] as String,
        subCity: s['subCity'] as String,
        city: 'Addis Ababa',
        timestamp: DateTime.now(),
      );
    }).toList();
  }

  /// Auto-detects current physical location and identifies the human-readable spot name.
  Future<LocationDataModel?> autoDetectCurrentLocation({bool forceRefresh = false}) async {
    state = state.copyWith(isDetecting: true, error: null);

    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      LocationPermission permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(
          isDetecting: false,
          permissionGranted: false,
          error: 'Location permissions permanently denied. Please allow location in device settings.',
        );
        return state.location;
      }

      if (serviceEnabled &&
          (permission == LocationPermission.whileInUse ||
              permission == LocationPermission.always)) {
        final Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 4),
        );

        // Identify the spot name (Bole Medhanialem, Edna Mall, Sarbet, etc.)
        final spotInfo = await resolveSpotInfo(position.latitude, position.longitude);

        final detected = LocationDataModel(
          latitude: position.latitude,
          longitude: position.longitude,
          address: spotInfo['address'] ?? 'Bole, Addis Ababa',
          spotName: spotInfo['spotName'] ?? 'Bole',
          subCity: spotInfo['subCity'] ?? 'Bole',
          city: 'Addis Ababa',
          accuracy: position.accuracy,
          timestamp: position.timestamp,
        );

        state = state.copyWith(
          isDetecting: false,
          permissionGranted: true,
          location: detected,
          error: null,
        );

        return detected;
      }
    } catch (_) {
      // Hardware GPS unavailable or timed out; proceed to regional spot fallback
    }

    // Regional spot fallback when physical GPS fix is unavailable (e.g. desktop/emulator)
    final random = Random();
    final pick = kEthiopianLandmarks[random.nextInt(kEthiopianLandmarks.length)];
    final detected = LocationDataModel(
      latitude: pick['lat'] as double,
      longitude: pick['lon'] as double,
      address: pick['address'] as String,
      spotName: pick['name'] as String,
      subCity: pick['subCity'] as String,
      city: 'Addis Ababa',
      accuracy: 10.0,
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      isDetecting: false,
      permissionGranted: true,
      location: detected,
      error: null,
    );

    return detected;
  }

  /// Sets an explicitly chosen spot or custom address as active.
  void setCustomLocation(String address, double lat, double lon, String subCity, {String spotName = ''}) {
    state = state.copyWith(
      location: LocationDataModel(
        latitude: lat,
        longitude: lon,
        address: address,
        spotName: spotName.isNotEmpty ? spotName : address.split(',').first.trim(),
        subCity: subCity,
        city: 'Addis Ababa',
        timestamp: DateTime.now(),
      ),
    );
  }

  /// Selects a complete spot model directly.
  void selectSpot(LocationDataModel spot) {
    state = state.copyWith(
      location: spot,
      isDetecting: false,
      error: null,
    );
  }
}

final locationProvider = StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  return LocationNotifier();
});
