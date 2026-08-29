import 'package:flutter/foundation.dart';

final String defaultApiUrl = kIsWeb
    ? 'http://localhost:3000/api/v1'
    : (defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:3000/api/v1'
        : 'http://localhost:3000/api/v1');

final String defaultRealtimeUrl = kIsWeb
    ? 'ws://localhost:3000/realtime'
    : (defaultTargetPlatform == TargetPlatform.android
        ? 'ws://10.0.2.2:3000/realtime'
        : 'ws://localhost:3000/realtime');
