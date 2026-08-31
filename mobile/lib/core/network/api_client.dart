import 'io_client_base.dart'; // import conditional helper to support platform compilation
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  final Dio dio;

  ApiClient({String? baseUrl}) : dio = Dio() {
    dio.options.baseUrl = baseUrl ?? defaultApiUrl;
    dio.options.connectTimeout = const Duration(seconds: 15);
    dio.options.receiveTimeout = const Duration(seconds: 15);

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await SecureStorage.instance.readToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          options.headers['Content-Type'] = 'application/json';
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (response.data is Map<String, dynamic>) {
            final map = response.data as Map<String, dynamic>;
            if (map.containsKey('success') && map.containsKey('data')) {
              response.data = map['data'];
            }
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) {
          // Global error handling or token refreshing could go here
          return handler.next(e);
        },
      ),
    );
  }
}
