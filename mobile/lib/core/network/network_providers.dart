import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'realtime_service.dart';
import 'offline_queue_service.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final realtimeServiceProvider = Provider<MobileRealtimeService>((ref) {
  final service = MobileRealtimeService();
  ref.onDispose(() => service.dispose());
  return service;
});

final offlineQueueServiceProvider = Provider<OfflineQueueService>((ref) {
  final service = OfflineQueueService();
  ref.onDispose(() => service.dispose());
  return service;
});
