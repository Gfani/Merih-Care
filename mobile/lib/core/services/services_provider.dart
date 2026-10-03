import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/network_providers.dart';
import '../network/api_client.dart';
import '../storage/secure_storage.dart';

class ServiceModel {
  final String id;
  final String name;
  final String description;
  final double priceFrom;
  final String icon;
  final String status;
  final int providerCount;

  const ServiceModel({
    required this.id,
    required this.name,
    required this.description,
    required this.priceFrom,
    required this.icon,
    this.status = 'active',
    this.providerCount = 0,
  });

  bool get isActive => status.toLowerCase() == 'active';

  factory ServiceModel.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['priceFrom'] ?? json['price'] ?? 500;
    double parsedPrice = 500.0;
    if (rawPrice is num) {
      parsedPrice = rawPrice.toDouble();
    } else if (rawPrice != null) {
      parsedPrice = double.tryParse(rawPrice.toString()) ?? 500.0;
    }

    final rawCount = json['providerCount'] ?? json['count'] ?? 0;
    int parsedCount = 0;
    if (rawCount is num) {
      parsedCount = rawCount.toInt();
    } else if (rawCount != null) {
      parsedCount = int.tryParse(rawCount.toString()) ?? 0;
    }

    return ServiceModel(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? json['title'] ?? 'Medical Service').toString(),
      description: (json['description'] ?? 'Certified home health clinical service provided by licensed professionals.').toString(),
      priceFrom: parsedPrice,
      icon: (json['icon'] ?? 'Activity').toString(),
      status: (json['status'] ?? 'active').toString(),
      providerCount: parsedCount,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'priceFrom': priceFrom,
    'icon': icon,
    'status': status,
    'providerCount': providerCount,
  };

  IconData get iconData {
    final lower = ('$icon $name').toLowerCase();
    if (lower.contains('doctor') || lower.contains('medical') || lower.contains('activity') || lower.contains('physician')) {
      return Icons.medical_services_outlined;
    } else if (lower.contains('nurse') || lower.contains('heart') || lower.contains('vital')) {
      return Icons.favorite_border;
    } else if (lower.contains('physio') || lower.contains('rehab') || lower.contains('therapy') || lower.contains('walk')) {
      return Icons.directions_run;
    } else if (lower.contains('elder') || lower.contains('senior') || lower.contains('palliative')) {
      return Icons.elderly_outlined;
    } else if (lower.contains('lab') || lower.contains('test') || lower.contains('specimen')) {
      return Icons.science_outlined;
    } else if (lower.contains('maternal') || lower.contains('child') || lower.contains('baby') || lower.contains('prenatal')) {
      return Icons.child_care_outlined;
    } else if (lower.contains('med') || lower.contains('pill') || lower.contains('pharmacy')) {
      return Icons.medication_outlined;
    } else if (lower.contains('wound') || lower.contains('bandage') || lower.contains('post-op') || lower.contains('heal')) {
      return Icons.healing_outlined;
    }
    return Icons.medical_services_outlined;
  }

  Color get categoryColor {
    final lower = name.toLowerCase();
    if (lower.contains('doctor')) return const Color(0xFFE6F5F2);
    if (lower.contains('nurs')) return const Color(0xFFFEF3C7);
    if (lower.contains('physio')) return const Color(0xFFE8F1FB);
    if (lower.contains('elder')) return const Color(0xFFF5E6FF);
    if (lower.contains('lab')) return const Color(0xFFFEE2E2);
    if (lower.contains('matern') || lower.contains('child')) return const Color(0xFFFCE7F3);
    if (lower.contains('med')) return const Color(0xFFECFDF5);
    return const Color(0xFFE0E7FF);
  }
}

final servicesProvider = StateNotifierProvider<ServicesNotifier, List<ServiceModel>>((ref) {
  final client = ref.read(apiClientProvider);
  return ServicesNotifier(client);
});

class ServicesNotifier extends StateNotifier<List<ServiceModel>> {
  final ApiClient _client;
  static const _storageKey = 'cached_admin_services';

  ServicesNotifier(this._client) : super([]) {
    _loadFromCacheAndFetch();
  }

  Future<void> _loadFromCacheAndFetch() async {
    try {
      final cached = await SecureStorage.instance.readString(_storageKey);
      if (cached != null && cached.isNotEmpty) {
        final decoded = jsonDecode(cached);
        if (decoded is List && decoded.isNotEmpty) {
          state = decoded.map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map))).toList();
        }
      }
    } catch (_) {}

    await refreshServices();
  }

  Future<void> refreshServices() async {
    try {
      final res = await _client.dio.get('/services');
      final dynamic data = res.data;
      List rawList = [];
      if (data is List) {
        rawList = data;
      } else if (data is Map && data['data'] is List) {
        rawList = data['data'];
      }

      if (rawList.isNotEmpty) {
        final List<ServiceModel> services = [];
        final Set<String> seenNames = {};
        for (var item in rawList) {
          if (item is Map) {
            final model = ServiceModel.fromJson(Map<String, dynamic>.from(item));
            final normalized = model.name.toLowerCase().trim();
            if (!seenNames.contains(normalized)) {
              seenNames.add(normalized);
              services.add(model);
            }
          }
        }

        if (services.isNotEmpty) {
          state = services;
          try {
            await SecureStorage.instance.writeString(
              _storageKey,
              jsonEncode(services.map((s) => s.toJson()).toList()),
            );
          } catch (_) {}
        }
      }
    } catch (e) {
      print('[SERVICES_PROVIDER] Error fetching live services: $e');
    }
  }
}
