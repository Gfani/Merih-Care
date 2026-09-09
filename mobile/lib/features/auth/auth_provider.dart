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

class SignupResult {
  final bool success;
  final bool pendingApproval;
  final String? message;

  const SignupResult({
    required this.success,
    this.pendingApproval = false,
    this.message,
  });
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

  Future<String?> uploadCredentialDocument(String fileName, List<int> bytes) async {
    try {
      final client = _ref.read(apiClientProvider);
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: fileName),
      });
      final response = await client.dio.post('/uploads/credential', data: formData);
      final dynamic rawData = response.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic> && rawData.containsKey('data'))
          ? (rawData['data'] as Map<String, dynamic>)
          : (rawData is Map<String, dynamic> ? rawData : <String, dynamic>{});
      return data['storageKey']?.toString() ?? data['url']?.toString() ?? data['filePath']?.toString();
    } catch (e) {
      print('[AUTH] uploadCredentialDocument error: $e');
      return null;
    }
  }

  Future<SignupResult> signup(
    String name,
    String email,
    String password,
    String phone, {
    String role = 'patient',
    Map<String, dynamic>? providerData,
  }) async {
    state = state.copyWith(errorMessage: null);
    try {
      print('[AUTH] signup: registering $email as $role...');
      final client = _ref.read(apiClientProvider);
      final payload = <String, dynamic>{
        'name': name,
        'email': email,
        'password': password,
        'phone': phone,
        'role': role,
      };
      if (providerData != null) {
        payload.addAll(providerData);
      }
      final response = await client.dio.post('/auth/signup', data: payload);
      print('[AUTH] signup: response received: ${response.statusCode}');

      final dynamic rawData = response.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic> && rawData.containsKey('data') && rawData['data'] is Map<String, dynamic>)
          ? (rawData['data'] as Map<String, dynamic>)
          : (rawData is Map<String, dynamic> ? rawData : <String, dynamic>{});

      final token = (data['access_token'] ?? data['token'] ?? '').toString();
      final user = (data['user'] is Map<String, dynamic>)
          ? (data['user'] as Map<String, dynamic>)
          : <String, dynamic>{'name': name, 'email': email, 'phone': phone, 'role': role};

      final bool isPending = role == 'provider' || token.isEmpty || user['isApproved'] == false;
      final String? msg = (data['message'] ?? (rawData is Map<String, dynamic> ? rawData['message'] : null))?.toString();

      if (isPending) {
        print('[AUTH] signup: provider registered pending admin approval.');
        state = AuthState(
          status: AuthStatus.unauthenticated,
          token: null,
          user: user,
        );
        return SignupResult(
          success: true,
          pendingApproval: true,
          message: msg ?? 'Registration submitted successfully. Your provider account is pending administrator approval before you can log in.',
        );
      }

      await SecureStorage.instance.writeToken(token);
      print('[AUTH] signup: token written. Authenticated: $email, role=${user['role']}');
      state = AuthState(
        status: AuthStatus.authenticated,
        token: token,
        user: user,
      );
      return const SignupResult(success: true, pendingApproval: false);
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
      return SignupResult(success: false, message: msg);
    } catch (e) {
      print('[AUTH] signup error: $e');
      state = state.copyWith(errorMessage: e.toString());
      return SignupResult(success: false, message: e.toString());
    }
  }

  Future<SignupResult> signInWithGoogle({
    String role = 'patient',
    Map<String, dynamic>? providerData,
    String? testIdToken,
  }) async {
    try {
      state = state.copyWith(errorMessage: null);

      final String token = testIdToken ??
          'test-google-token:user.${DateTime.now().millisecondsSinceEpoch}@gmail.com:MerihCare User';

      final payload = <String, dynamic>{
        'idToken': token,
        'role': role,
      };
      if (providerData != null) {
        payload.addAll(providerData);
      }

      final client = _ref.read(apiClientProvider);
      final response = await client.dio.post('/auth/google', data: payload);
      final dynamic rawData = response.data;
      final Map<String, dynamic> data = (rawData is Map<String, dynamic> && rawData.containsKey('data') && rawData['data'] is Map<String, dynamic>)
          ? (rawData['data'] as Map<String, dynamic>)
          : (rawData is Map<String, dynamic> ? rawData : <String, dynamic>{});

      final accessToken = (data['access_token'] ?? data['token'] ?? '').toString();
      final user = (data['user'] is Map<String, dynamic>)
          ? (data['user'] as Map<String, dynamic>)
          : <String, dynamic>{'role': role};

      final bool isPending = role == 'provider' && (data['pendingApproval'] == true || accessToken.isEmpty || user['isApproved'] == false);
      final String? msg = (data['message'] ?? (rawData is Map<String, dynamic> ? rawData['message'] : null))?.toString();

      if (isPending) {
        state = AuthState(
          status: AuthStatus.unauthenticated,
          token: null,
          user: user,
        );
        return SignupResult(
          success: true,
          pendingApproval: true,
          message: msg ?? 'Signed in via Google. Your provider account is pending administrator approval before you can access clinical features.',
        );
      }

      if (accessToken.isNotEmpty) {
        await SecureStorage.instance.writeToken(accessToken);
        state = AuthState(
          status: AuthStatus.authenticated,
          token: accessToken,
          user: user,
        );
        return const SignupResult(success: true, pendingApproval: false);
      }

      return SignupResult(success: false, message: msg ?? 'Failed to authenticate with Google');
    } on DioException catch (e) {
      final dynamic body = e.response?.data;
      String msg = 'Google authentication failed';
      if (body is Map<String, dynamic>) {
        msg = (body['message'] ?? body['error'] ?? 'Google authentication failed').toString();
      } else if (e.message != null) {
        msg = e.message!;
      }
      state = state.copyWith(errorMessage: msg);
      return SignupResult(success: false, message: msg);
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
      return SignupResult(success: false, message: e.toString());
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
