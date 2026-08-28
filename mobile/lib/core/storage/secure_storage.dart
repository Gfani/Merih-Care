import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage._privateConstructor();
  static final SecureStorage instance = SecureStorage._privateConstructor();

  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'auth_token';

  // Fallback cache for Web or environments where secure storage is unavailable
  String? _tokenFallback;

  Future<void> writeToken(String token) async {
    if (kIsWeb) {
      _tokenFallback = token;
      return;
    }
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {
      _tokenFallback = token;
    }
  }

  Future<String?> readToken() async {
    if (kIsWeb) {
      return _tokenFallback;
    }
    try {
      return await _storage.read(key: _tokenKey);
    } catch (_) {
      return _tokenFallback;
    }
  }

  Future<void> deleteToken() async {
    if (kIsWeb) {
      _tokenFallback = null;
      return;
    }
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {
      _tokenFallback = null;
    }
  }
}
