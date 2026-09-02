import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class QueuedAction {
  final String id;
  final String actionType; // e.g. 'send_message', 'rate_provider', 'book_appointment'
  final Map<String, dynamic> payload;
  final int timestamp;
  int retryCount;

  QueuedAction({
    required this.id,
    required this.actionType,
    required this.payload,
    required this.timestamp,
    this.retryCount = 0,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'actionType': actionType,
        'payload': payload,
        'timestamp': timestamp,
        'retryCount': retryCount,
      };

  factory QueuedAction.fromJson(Map<String, dynamic> json) => QueuedAction(
        id: json['id'] as String,
        actionType: json['actionType'] as String,
        payload: json['payload'] as Map<String, dynamic>,
        timestamp: json['timestamp'] as int,
        retryCount: json['retryCount'] as int? ?? 0,
      );
}

typedef ActionHandler = Future<bool> Function(QueuedAction action);

class OfflineQueueService {
  final FlutterSecureStorage _storage;
  final Connectivity _connectivity;
  final Map<String, ActionHandler> _handlers = {};
  final List<QueuedAction> _queue = [];
  bool _isProcessing = false;
  StreamSubscription? _connectivitySub;

  static const String _storageKey = 'merihcare_offline_action_queue';

  OfflineQueueService({
    FlutterSecureStorage? storage,
    Connectivity? connectivity,
  })  : _storage = storage ?? const FlutterSecureStorage(),
        _connectivity = connectivity ?? Connectivity() {
    _init();
  }

  void _init() async {
    await _loadQueueFromStorage();
    _connectivitySub = _connectivity.onConnectivityChanged.listen((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline) {
        flushQueue();
      }
    });
  }

  /// Register an action executor for a specific action type
  void registerHandler(String actionType, ActionHandler handler) {
    _handlers[actionType] = handler;
  }

  /// Add an action to the offline queue
  Future<void> enqueue(String actionType, Map<String, dynamic> payload) async {
    final action = QueuedAction(
      id: 'act_${DateTime.now().millisecondsSinceEpoch}_${_queue.length}',
      actionType: actionType,
      payload: payload,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );

    _queue.add(action);
    await _saveQueueToStorage();

    // Try processing immediately if online
    final connectivity = await _connectivity.checkConnectivity();
    if (connectivity.any((c) => c != ConnectivityResult.none)) {
      flushQueue();
    }
  }

  /// Flush all queued actions sequentially
  Future<void> flushQueue() async {
    if (_isProcessing || _queue.isEmpty) return;
    _isProcessing = true;

    final List<QueuedAction> remaining = [];

    for (final action in _queue) {
      final handler = _handlers[action.actionType];
      if (handler != null) {
        try {
          final success = await handler(action);
          if (!success) {
            action.retryCount++;
            if (action.retryCount < 5) remaining.add(action);
          }
        } catch (e) {
          action.retryCount++;
          if (action.retryCount < 5) remaining.add(action);
        }
      } else {
        // No handler registered yet; keep in queue
        remaining.add(action);
      }
    }

    _queue.clear();
    _queue.addAll(remaining);
    await _saveQueueToStorage();
    _isProcessing = false;
  }

  int get pendingCount => _queue.length;

  Future<void> _loadQueueFromStorage() async {
    try {
      final raw = await _storage.read(key: _storageKey);
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> list = jsonDecode(raw);
        _queue.clear();
        _queue.addAll(list.map((item) => QueuedAction.fromJson(item)));
      }
    } catch (_) {
      // Storage corrupted or empty
    }
  }

  Future<void> _saveQueueToStorage() async {
    try {
      final raw = jsonEncode(_queue.map((a) => a.toJson()).toList());
      await _storage.write(key: _storageKey, value: raw);
    } catch (_) {}
  }

  void dispose() {
    _connectivitySub?.cancel();
  }
}
