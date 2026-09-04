import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'io_client_base.dart';

enum RealtimeConnectionState { disconnected, connecting, connected, authFailed }

class RealtimeEventEnvelope {
  final int version;
  final String event;
  final dynamic data;
  final String timestamp;

  RealtimeEventEnvelope({
    required this.version,
    required this.event,
    required this.data,
    required this.timestamp,
  });

  factory RealtimeEventEnvelope.fromJson(Map<String, dynamic> json) {
    return RealtimeEventEnvelope(
      version: json['v'] as int? ?? 1,
      event: json['event'] as String? ?? '',
      data: json['data'],
      timestamp: json['ts'] as String? ?? DateTime.now().toIso8601String(),
    );
  }
}

class MobileRealtimeService {
  io.Socket? _realtimeSocket;
  io.Socket? _chatSocket;
  String? _token;
  String _baseUrl = defaultRealtimeUrl;

  final _connectionStateController = StreamController<RealtimeConnectionState>.broadcast();
  final _appointmentUpdatesController = StreamController<Map<String, dynamic>>.broadcast();
  final _serviceRequestsController = StreamController<Map<String, dynamic>>.broadcast();
  final _providerResponsesController = StreamController<Map<String, dynamic>>.broadcast();
  final _locationUpdatesController = StreamController<Map<String, dynamic>>.broadcast();
  final _emergencyAlertsController = StreamController<Map<String, dynamic>>.broadcast();
  final _chatMessagesController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final _messagesReadController = StreamController<Map<String, dynamic>>.broadcast();

  final Set<String> _joinedRooms = {};
  DateTime? _lastLocationSentAt;
  RealtimeConnectionState _currentState = RealtimeConnectionState.disconnected;

  // Streams
  Stream<RealtimeConnectionState> get connectionStateStream => _connectionStateController.stream;
  Stream<Map<String, dynamic>> get appointmentUpdatesStream => _appointmentUpdatesController.stream;
  Stream<Map<String, dynamic>> get serviceRequestsStream => _serviceRequestsController.stream;
  Stream<Map<String, dynamic>> get providerResponsesStream => _providerResponsesController.stream;
  Stream<Map<String, dynamic>> get locationUpdatesStream => _locationUpdatesController.stream;
  Stream<Map<String, dynamic>> get emergencyAlertsStream => _emergencyAlertsController.stream;
  Stream<Map<String, dynamic>> get chatMessagesStream => _chatMessagesController.stream;
  Stream<Map<String, dynamic>> get typingStream => _typingController.stream;
  Stream<Map<String, dynamic>> get messagesReadStream => _messagesReadController.stream;

  RealtimeConnectionState get currentState => _currentState;
  bool get isConnected => _currentState == RealtimeConnectionState.connected;

  void _updateState(RealtimeConnectionState state) {
    _currentState = state;
    _connectionStateController.add(state);
  }

  /// Connect to both /realtime and /chat namespaces
  void connect({required String token, String? baseUrl}) {
    _token = token;
    if (baseUrl != null) _baseUrl = baseUrl;

    _updateState(RealtimeConnectionState.connecting);

    // Initialize /realtime socket
    _realtimeSocket = io.io(
      '$_baseUrl/realtime',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': _token})
          .enableReconnection()
          .setReconnectionAttempts(999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .build(),
    );

    _realtimeSocket!.onConnect((_) {
      _updateState(RealtimeConnectionState.connected);
      _restoreSession();
    });

    _realtimeSocket!.on('connection_established', (data) {
      _updateState(RealtimeConnectionState.connected);
    });

    _realtimeSocket!.onDisconnect((_) {
      _updateState(RealtimeConnectionState.disconnected);
    });

    _realtimeSocket!.onConnectError((err) {
      if (err.toString().contains('Unauthorized')) {
        _updateState(RealtimeConnectionState.authFailed);
      } else {
        _updateState(RealtimeConnectionState.disconnected);
      }
    });

    // Heartbeat pong responder
    _realtimeSocket!.on('ping', (_) {
      _realtimeSocket?.emit('pong');
    });

    // Domain event listeners
    _realtimeSocket!.on('appointment_status_update', (data) {
      if (data is Map<String, dynamic>) _appointmentUpdatesController.add(data);
    });

    _realtimeSocket!.on('new_service_request', (data) {
      if (data is Map<String, dynamic>) _serviceRequestsController.add(data);
    });

    _realtimeSocket!.on('provider_response', (data) {
      if (data is Map<String, dynamic>) _providerResponsesController.add(data);
    });

    _realtimeSocket!.on('location_update', (data) {
      if (data is Map<String, dynamic>) _locationUpdatesController.add(data);
    });

    _realtimeSocket!.on('emergency_alert', (data) {
      if (data is Map<String, dynamic>) _emergencyAlertsController.add(data);
    });

    // Initialize /chat socket
    _chatSocket = io.io(
      '$_baseUrl/chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': _token})
          .enableReconnection()
          .build(),
    );

    _chatSocket!.on('new_message', (data) {
      if (data is Map<String, dynamic>) _chatMessagesController.add(data);
    });

    _chatSocket!.on('typing', (data) {
      if (data is Map<String, dynamic>) _typingController.add(data);
    });

    _chatSocket!.on('messages_read', (data) {
      if (data is Map<String, dynamic>) _messagesReadController.add(data);
    });
  }

  /// Re-join previously joined rooms after reconnection
  void _restoreSession() {
    if (_joinedRooms.isNotEmpty) {
      _realtimeSocket?.emit('restore_session', {'rooms': _joinedRooms.toList()});
    }
  }

  /// Join appointment room
  void joinAppointment(String appointmentId) {
    final room = 'appointment:$appointmentId';
    _joinedRooms.add(room);
    _realtimeSocket?.emit('join_appointment', {'appointmentId': appointmentId});
  }

  /// Join emergency room
  void joinEmergency(String emergencyId) {
    final room = 'emergency:$emergencyId';
    _joinedRooms.add(room);
    _realtimeSocket?.emit('join_emergency', {'emergencyId': emergencyId});
  }

  /// Join chat conversation room
  void joinConversation(String conversationId) {
    _chatSocket?.emit('join_conversation', {'conversationId': conversationId});
  }

  /// Leave chat conversation room
  void leaveConversation(String conversationId) {
    _chatSocket?.emit('leave_conversation', {'conversationId': conversationId});
  }

  /// Send provider location with 3-second client-side throttle & optional privacy masking
  bool sendLocationUpdate({
    required String appointmentId,
    required double latitude,
    required double longitude,
    bool privacyMode = false,
  }) {
    final now = DateTime.now();
    if (_lastLocationSentAt != null &&
        now.difference(_lastLocationSentAt!).inMilliseconds < 3000) {
      return false; // Throttled
    }

    _lastLocationSentAt = now;

    // If privacy mode is on, mask precision to 2 decimal places (~1km)
    double lat = latitude;
    double lng = longitude;
    if (privacyMode) {
      lat = double.parse(lat.toStringAsFixed(2));
      lng = double.parse(lng.toStringAsFixed(2));
    }

    _realtimeSocket?.emit('location_update', {
      'appointmentId': appointmentId,
      'lat': lat,
      'lng': lng,
    });
    return true;
  }

  /// Send chat message
  void sendChatMessage({
    required String conversationId,
    required String text,
    String? replyToId,
  }) {
    _chatSocket?.emit('send_message', {
      'conversationId': conversationId,
      'text': text,
      'replyToId': replyToId,
    });
  }

  /// Send typing status
  void sendTyping(String conversationId, bool isTyping) {
    if (isTyping) {
      _chatSocket?.emit('typing_start', {'conversationId': conversationId});
    } else {
      _chatSocket?.emit('typing_stop', {'conversationId': conversationId});
    }
  }

  /// Mark message as read
  void markMessageRead(String conversationId, String messageId) {
    _chatSocket?.emit('mark_read', {
      'conversationId': conversationId,
      'messageId': messageId,
    });
  }

  /// Disconnect all sockets and clean up
  void disconnect() {
    _realtimeSocket?.disconnect();
    _realtimeSocket?.dispose();
    _realtimeSocket = null;

    _chatSocket?.disconnect();
    _chatSocket?.dispose();
    _chatSocket = null;

    _joinedRooms.clear();
    _updateState(RealtimeConnectionState.disconnected);
  }

  void dispose() {
    disconnect();
    _connectionStateController.close();
    _appointmentUpdatesController.close();
    _serviceRequestsController.close();
    _providerResponsesController.close();
    _locationUpdatesController.close();
    _emergencyAlertsController.close();
    _chatMessagesController.close();
    _typingController.close();
    _messagesReadController.close();
  }
}
