import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../notifications/notification_service.dart';
import '../network/api_client.dart';

class SecureStorage {
  SecureStorage._privateConstructor();
  static final SecureStorage instance = SecureStorage._privateConstructor();

  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'auth_token';

  String? _tokenFallback;

  Future<void> writeToken(String token) async {
    _tokenFallback = token;
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
    // Ensure FCM push token is registered with backend under this authenticated user session
    NotificationService.instance.syncTokenWithBackend();
  }

  Future<String?> readToken() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token != null && token.isNotEmpty) {
        _tokenFallback = token;
        return token;
      }
    } catch (_) {}
    return _tokenFallback;
  }

  Future<void> deleteToken() async {
    // Unregister device push token before deleting credentials
    try {
      await ApiClient().unregisterPushToken();
    } catch (_) {}
    _tokenFallback = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }
}
