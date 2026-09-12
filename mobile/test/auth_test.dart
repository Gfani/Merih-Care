import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:merihcare/features/auth/auth_provider.dart';
import 'package:merihcare/core/storage/secure_storage.dart';
import 'package:merihcare/core/network/api_client.dart';
import 'package:merihcare/core/network/network_providers.dart';

class _MockApiClient extends ApiClient {
  _MockApiClient() : super(baseUrl: 'http://localhost') {
    dio.interceptors.clear();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {'success': true},
          ),
        ),
      ),
    );
  }
}

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('Authentication Unit Tests', () {
    test('Initial auth state should be unauthenticated or unknown without token', () async {
      final container = ProviderContainer();
      final state = container.read(authProvider);

      expect(state.status == AuthStatus.unknown || state.status == AuthStatus.unauthenticated, isTrue);
      expect(state.token, isNull);
      expect(state.user, isNull);
    });

    test('AuthState copyWith should preserve and update properties correctly', () {
      final initial = AuthState(
        status: AuthStatus.unauthenticated,
        token: null,
        errorMessage: null,
      );

      final updated = initial.copyWith(
        status: AuthStatus.authenticated,
        token: 'mock-jwt-token-xyz',
        user: {'name': 'Abebe Kebede', 'role': 'patient'},
      );

      expect(updated.status, AuthStatus.authenticated);
      expect(updated.token, 'mock-jwt-token-xyz');
      expect(updated.user?['name'], 'Abebe Kebede');
      expect(updated.user?['role'], 'patient');
    });

    test('SecureStorage should store and delete session token correctly', () async {
      final storage = SecureStorage.instance;

      await storage.writeToken('jwt-session-token-456');
      final read = await storage.readToken();
      expect(read, 'jwt-session-token-456');

      await storage.deleteToken();
      final deleted = await storage.readToken();
      expect(deleted, isNull);
    });

    test('Logout should reset AuthState to unauthenticated and clear stored token', () async {
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(_MockApiClient()),
        ],
      );
      final notifier = container.read(authProvider.notifier);

      await SecureStorage.instance.writeToken('mock-active-token');
      await notifier.logout();

      final state = container.read(authProvider);
      expect(state.status, AuthStatus.unauthenticated);
      expect(state.token, isNull);
      expect(state.user, isNull);

      final storedToken = await SecureStorage.instance.readToken();
      expect(storedToken, isNull);
    });
  });
}
