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
    await NotificationService.instance.syncTokenWithBackend();
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
    await NotificationService.instance.unregisterToken();
    _tokenFallback = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }

  static const _phoneKey = 'last_used_phone';
  static const _emailKey = 'last_used_email';
  String? _phoneFallback;
  String? _emailFallback;

  Future<void> writeLastPhone(String phone) async {
    _phoneFallback = phone;
    try {
      await _storage.write(key: _phoneKey, value: phone);
    } catch (_) {}
  }

  Future<String?> readLastPhone() async {
    try {
      final p = await _storage.read(key: _phoneKey);
      if (p != null && p.isNotEmpty) {
        _phoneFallback = p;
        return p;
      }
    } catch (_) {}
    return _phoneFallback;
  }

  Future<void> writeLastEmail(String email) async {
    _emailFallback = email;
    try {
      await _storage.write(key: _emailKey, value: email);
    } catch (_) {}
  }

  Future<String?> readLastEmail() async {
    try {
      final e = await _storage.read(key: _emailKey);
      if (e != null && e.isNotEmpty) {
        _emailFallback = e;
        return e;
      }
    } catch (_) {}
    return _emailFallback;
  }
}
