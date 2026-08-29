import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LocationDataModel {
  final double latitude;
  final double longitude;
  final String address;
  final String subCity;
  final String city;
  final double accuracy;
  final DateTime timestamp;

  const LocationDataModel({
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.subCity,
    this.city = 'Addis Ababa',
    this.accuracy = 10.0,
    required this.timestamp,
  });

  String get shortAddress => '$subCity, $city';
  String get fullAddress => address.isNotEmpty ? address : shortAddress;
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

class LocationNotifier extends StateNotifier<LocationState> {
  LocationNotifier()
      : super(
          LocationState(
            location: LocationDataModel(
              latitude: 9.0054,
              longitude: 38.7845,
              address: 'Bole Sub City, House 412, Addis Ababa',
              subCity: 'Bole',
              city: 'Addis Ababa',
              accuracy: 8.5,
              timestamp: DateTime.now(),
            ),
          ),
        );

  static final List<Map<String, dynamic>> _knownLocations = [
    {
      'subCity': 'Bole',
      'address': 'Bole Sub City, Near Edna Mall, Addis Ababa',
      'lat': 9.0054,
      'lon': 38.7845,
    },
    {
      'subCity': 'Kazanchis',
      'address': 'Kazanchis, Guinea Conakry St, Addis Ababa',
      'lat': 9.0186,
      'lon': 38.7698,
    },
    {
      'subCity': 'Sarbet',
      'address': 'Sarbet, Near Karl Square, Addis Ababa',
      'lat': 8.9950,
      'lon': 38.7380,
    },
    {
      'subCity': 'Old Airport',
      'address': 'Old Airport, Golf Club Rd, Addis Ababa',
      'lat': 8.9875,
      'lon': 38.7302,
    },
    {
      'subCity': 'Megenagna',
      'address': 'Megenagna Roundabout, Zefmesh Mall, Addis Ababa',
      'lat': 9.0225,
      'lon': 38.8021,
    },
    {
      'subCity': 'Piassa',
      'address': 'Piassa, Churchill Avenue, Addis Ababa',
      'lat': 9.0350,
      'lon': 38.7520,
    },
    {
      'subCity': 'CMC',
      'address': 'CMC Residential Village, Block 8, Addis Ababa',
      'lat': 9.0280,
      'lon': 38.8350,
    },
  ];

  Future<LocationDataModel?> autoDetectCurrentLocation({bool forceRefresh = false}) async {
    state = state.copyWith(isDetecting: true, error: null);

    try {
      // Simulate real-world GPS acquisition delay and satellite fix
      await Future.delayed(const Duration(milliseconds: 650));

      final random = Random();
      final pick = _knownLocations[random.nextInt(_knownLocations.length)];
      
      // Add slight jitter to simulate live coordinates
      final jitterLat = (random.nextDouble() - 0.5) * 0.002;
      final jitterLon = (random.nextDouble() - 0.5) * 0.002;

      final detected = LocationDataModel(
        latitude: (pick['lat'] as double) + jitterLat,
        longitude: (pick['lon'] as double) + jitterLon,
        address: pick['address'] as String,
        subCity: pick['subCity'] as String,
        city: 'Addis Ababa',
        accuracy: 5.0 + random.nextDouble() * 10.0,
        timestamp: DateTime.now(),
      );

      state = state.copyWith(
        isDetecting: false,
        permissionGranted: true,
        location: detected,
        error: null,
      );

      return detected;
    } catch (e) {
      state = state.copyWith(
        isDetecting: false,
        error: 'Failed to acquire GPS location: $e',
      );
      return null;
    }
  }

  void setCustomLocation(String address, double lat, double lon, String subCity) {
    state = state.copyWith(
      location: LocationDataModel(
        latitude: lat,
        longitude: lon,
        address: address,
        subCity: subCity,
        city: 'Addis Ababa',
        timestamp: DateTime.now(),
      ),
    );
  }
}

final locationProvider = StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  return LocationNotifier();
});
