import 'package:flutter/foundation.dart';

const String _envApiUrl = String.fromEnvironment('API_URL');
const String _envRealtimeUrl = String.fromEnvironment('REALTIME_URL');

// Production custom domain backend URL
const String _prodBackendUrl = 'https://api.merihcare.live';

final String defaultApiUrl = _envApiUrl.isNotEmpty
    ? _envApiUrl
    : (kReleaseMode
        ? '$_prodBackendUrl/api/v1'
        : (kIsWeb
            ? 'http://localhost:3000/api/v1'
            : (defaultTargetPlatform == TargetPlatform.android
                ? 'http://10.0.2.2:3000/api/v1'
                : 'http://localhost:3000/api/v1')));

final String defaultRealtimeUrl = _envRealtimeUrl.isNotEmpty
    ? _envRealtimeUrl
    : (kReleaseMode
        ? _prodBackendUrl
        : (kIsWeb
            ? 'http://localhost:3000'
            : (defaultTargetPlatform == TargetPlatform.android
                ? 'http://10.0.2.2:3000'
                : 'http://localhost:3000')));
