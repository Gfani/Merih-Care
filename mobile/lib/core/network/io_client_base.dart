import 'dart:io';
import 'package:flutter/foundation.dart';

final String defaultApiUrl = kIsWeb
    ? 'http://localhost:3000/api/v1'
    : (Platform.isAndroid ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1');

final String defaultRealtimeUrl = kIsWeb
    ? 'ws://localhost:3000/realtime'
    : (Platform.isAndroid ? 'ws://10.0.2.2:3000/realtime' : 'ws://localhost:3000/realtime');
