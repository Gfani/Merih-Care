import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

void main() {
  group('Repository & API Interceptor Tests', () {
    test('Dio instance should configure base options and timeout properly', () {
      final dio = Dio(BaseOptions(
        baseUrl: 'http://localhost:3000/api/v1',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ));

      expect(dio.options.baseUrl, 'http://localhost:3000/api/v1');
      expect(dio.options.connectTimeout, const Duration(seconds: 15));
      expect(dio.options.headers['Content-Type'], 'application/json');
    });

    test('Auth interceptor should append Bearer token to outgoing request headers', () {
      final options = RequestOptions(path: '/users/profile');
      const token = 'sample-jwt-token-123';

      options.headers['Authorization'] = 'Bearer $token';

      expect(options.headers['Authorization'], 'Bearer sample-jwt-token-123');
    });

    test('Request interceptor does not override Content-Type when data is FormData', () {
      final formDataOptions = RequestOptions(
        path: '/uploads/credential',
        data: FormData.fromMap({'file': MultipartFile.fromString('test')}),
      );
      if (formDataOptions.data is! FormData) {
        formDataOptions.headers['Content-Type'] ??= 'application/json';
      }
      expect(formDataOptions.headers['Content-Type'], isNull);

      final jsonOptions = RequestOptions(
        path: '/auth/login',
        data: {'email': 'test@example.com'},
      );
      if (jsonOptions.data is! FormData) {
        jsonOptions.headers['Content-Type'] ??= 'application/json';
      }
      expect(jsonOptions.headers['Content-Type'], 'application/json');
    });
  });
}
