import 'dart:io';

final String defaultApiUrl = Platform.isAndroid 
    ? 'http://10.0.2.2:3000/api/v1' 
    : 'http://localhost:3000/api/v1';

final String defaultRealtimeUrl = Platform.isAndroid
    ? 'http://10.0.2.2:3000/realtime'
    : 'http://localhost:3000/realtime';
