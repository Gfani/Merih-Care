import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/network/network_providers.dart';
import 'package:dio/dio.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final String? token;
  final String? errorMessage;
  final Map<String, dynamic>? user;

  AuthState({
    required this.status,
    this.token,
    this.errorMessage,
    this.user,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? token,
    String? errorMessage,
    Map<String, dynamic>? user,
  }) {
    return AuthState(
      status: status ?? this.status,
      token: token ?? this.token,
      errorMessage: errorMessage ?? this.errorMessage,
      user: user ?? this.user,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final Ref _ref;

  AuthNotifier(this._ref) : super(AuthState(status: AuthStatus.unknown)) {
    _checkToken();
  }

  Future<void> _checkToken() async {
    final token = await SecureStorage.instance.readToken();
    if (token != null) {
      try {
        final client = _ref.read(apiClientProvider);
        final response = await client.dio.get('/auth/profile');
        state = AuthState(
          status: AuthStatus.authenticated,
          token: token,
          user: response.data,
        );
      } catch (_) {
        await SecureStorage.instance.deleteToken();
        state = AuthState(status: AuthStatus.unauthenticated);
      }
    } else {
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(errorMessage: null);
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      final token = (response.data['access_token'] ?? response.data['token']) as String;
      final user = response.data['user'] as Map<String, dynamic>;
      
      await SecureStorage.instance.writeToken(token);
      state = AuthState(
        status: AuthStatus.authenticated,
        token: token,
        user: user,
      );
      return true;
    } on DioException catch (e) {
      final msg = e.response?.data['message'] ?? 'Login failed';
      state = state.copyWith(errorMessage: msg.toString());
      return false;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> signup(String name, String email, String password, String phone, {String role = 'patient'}) async {
    state = state.copyWith(errorMessage: null);
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.dio.post('/auth/signup', data: {
        'name': name,
        'email': email,
        'password': password,
        'phone': phone,
        'role': role,
      });
      final token = (response.data['access_token'] ?? response.data['token']) as String;
      final user = response.data['user'] as Map<String, dynamic>;
      
      await SecureStorage.instance.writeToken(token);
      state = AuthState(
        status: AuthStatus.authenticated,
        token: token,
        user: user,
      );
      return true;
    } on DioException catch (e) {
      final msg = e.response?.data['message'] ?? 'Registration failed';
      state = state.copyWith(errorMessage: msg.toString());
      return false;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await SecureStorage.instance.deleteToken();
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref);
});
