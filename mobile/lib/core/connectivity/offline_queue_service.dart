import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../network/api_client.dart';

class OfflineOperation {
  final String path;
  final String method;
  final Map<String, dynamic> data;
  final String timestamp;

  OfflineOperation({
    required this.path,
    required this.method,
    required this.data,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
        'path': path,
        'method': method,
        'data': data,
        'timestamp': timestamp,
      };

  factory OfflineOperation.fromJson(Map<String, dynamic> json) => OfflineOperation(
        path: json['path'],
        method: json['method'],
        data: json['data'] ?? {},
        timestamp: json['timestamp'] ?? '',
      );
}

class OfflineQueueService {
  OfflineQueueService._();
  static final OfflineQueueService instance = OfflineQueueService._();

  static const _storageKey = 'offline_queue';
  final _storage = const FlutterSecureStorage();

  Future<void> queueOperation(String path, String method, Map<String, dynamic> data) async {
    final list = await getQueue();
    list.add(OfflineOperation(
      path: path,
      method: method,
      data: data,
      timestamp: DateTime.now().toIso8601String(),
    ));
    await _saveQueue(list);
  }

  Future<List<OfflineOperation>> getQueue() async {
    try {
      final jsonStr = await _storage.read(key: _storageKey);
      if (jsonStr == null) return [];
      final List<dynamic> rawList = jsonDecode(jsonStr);
      return rawList.map((item) => OfflineOperation.fromJson(item)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveQueue(List<OfflineOperation> list) async {
    final jsonStr = jsonEncode(list.map((item) => item.toJson()).toList());
    await _storage.write(key: _storageKey, value: jsonStr);
  }

  Future<void> syncQueue(ApiClient client) async {
    final list = await getQueue();
    if (list.isEmpty) return;

    final failedList = <OfflineOperation>[];
    for (final op in list) {
      try {
        if (op.method.toUpperCase() == 'PUT') {
          await client.dio.put(op.path, data: op.data);
        } else if (op.method.toUpperCase() == 'POST') {
          await client.dio.post(op.path, data: op.data);
        }
      } catch (_) {
        // Keep it in the queue if it fails again
        failedList.add(op);
      }
    }
    await _saveQueue(failedList);
  }

  void startAutoSync(ApiClient client) {
    Connectivity().onConnectivityChanged.listen((results) async {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline) {
        await syncQueue(client);
      }
    });
  }
}
