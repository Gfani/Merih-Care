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
    print('[AUTH] _checkToken: checking stored session...');
    final token = await SecureStorage.instance.readToken();
    if (token != null) {
      try {
        final client = _ref.read(apiClientProvider);
        final response = await client.dio.get('/auth/profile');
        
        if (state.status == AuthStatus.authenticated) {
          print('[AUTH] _checkToken: already authenticated, skipping overwrite.');
          return;
        }
        
        print('[AUTH] _checkToken: session verified! User role: ${response.data['role']}');
        state = AuthState(
          status: AuthStatus.authenticated,
          token: token,
          user: response.data,
        );
      } catch (e) {
        print('[AUTH] _checkToken error: $e');
        if (state.status == AuthStatus.authenticated) {
          print('[AUTH] _checkToken: already authenticated, skipping clear.');
          return;
        }
        print('[AUTH] _checkToken: clearing expired session.');
        await SecureStorage.instance.deleteToken();
        state = AuthState(status: AuthStatus.unauthenticated);
      }
    } else {
      print('[AUTH] _checkToken: no session found.');
      if (state.status == AuthStatus.authenticated) return;
      state = AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(errorMessage: null);
    try {
      print('[AUTH] login: sending request for $email...');
      final client = _ref.read(apiClientProvider);
      final response = await client.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      print('[AUTH] login: response received: ${response.statusCode}');

      final dynamic rawData = response.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic> && rawData.containsKey('data') && rawData['data'] is Map<String, dynamic>)
          ? (rawData['data'] as Map<String, dynamic>)
          : (rawData is Map<String, dynamic> ? rawData : <String, dynamic>{});

      final token = (data['access_token'] ?? data['token'] ?? '').toString();
      final user = (data['user'] is Map<String, dynamic>)
          ? (data['user'] as Map<String, dynamic>)
          : <String, dynamic>{'name': email.split('@')[0], 'email': email, 'role': 'patient'};

      if (token.isNotEmpty) {
        await SecureStorage.instance.writeToken(token);
      }
      print('[AUTH] login: token written. Authenticated: $email, role=${user['role']}');
      state = AuthState(
        status: AuthStatus.authenticated,
        token: token,
        user: user,
      );
      return true;
    } on DioException catch (e) {
      print('[AUTH] login DioError: status=${e.response?.statusCode}, body=${e.response?.data}');
      final dynamic body = e.response?.data;
      String msg = 'Login failed';
      if (body is Map<String, dynamic>) {
        msg = (body['message'] ?? body['error'] ?? 'Invalid email or password').toString();
      } else if (e.message != null) {
        msg = e.message!;
      }
      state = state.copyWith(errorMessage: msg);
      return false;
    } catch (e) {
      print('[AUTH] login error: $e');
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> signup(String name, String email, String password, String phone, {String role = 'patient'}) async {
    state = state.copyWith(errorMessage: null);
    try {
      print('[AUTH] signup: registering $email as $role...');
      final client = _ref.read(apiClientProvider);
      final response = await client.dio.post('/auth/signup', data: {
        'name': name,
        'email': email,
        'password': password,
        'phone': phone,
        'role': role,
      });
      print('[AUTH] signup: response received: ${response.statusCode}');

      final dynamic rawData = response.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic> && rawData.containsKey('data') && rawData['data'] is Map<String, dynamic>)
          ? (rawData['data'] as Map<String, dynamic>)
          : (rawData is Map<String, dynamic> ? rawData : <String, dynamic>{});

      final token = (data['access_token'] ?? data['token'] ?? '').toString();
      final user = (data['user'] is Map<String, dynamic>)
          ? (data['user'] as Map<String, dynamic>)
          : <String, dynamic>{'name': name, 'email': email, 'phone': phone, 'role': role};

      if (token.isNotEmpty) {
        await SecureStorage.instance.writeToken(token);
      }
      print('[AUTH] signup: token written. Authenticated: $email, role=${user['role']}');
      state = AuthState(
        status: AuthStatus.authenticated,
        token: token,
        user: user,
      );
      return true;
    } on DioException catch (e) {
      print('[AUTH] signup DioError: status=${e.response?.statusCode}, body=${e.response?.data}');
      final dynamic body = e.response?.data;
      String msg = 'Registration failed';
      if (body is Map<String, dynamic>) {
        msg = (body['message'] ?? body['error'] ?? 'Registration failed').toString();
      } else if (e.message != null) {
        msg = e.message!;
      }
      state = state.copyWith(errorMessage: msg);
      return false;
    } catch (e) {
      print('[AUTH] signup error: $e');
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  void updateUser(Map<String, dynamic> user) {
    state = state.copyWith(user: user);
  }

  Future<void> logout() async {
    await SecureStorage.instance.deleteToken();
    state = AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref);
});
