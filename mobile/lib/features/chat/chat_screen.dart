import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/network/network_providers.dart';
import '../auth/auth_provider.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String appointmentId;

  const ChatScreen({super.key, required this.appointmentId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final List<Map<String, dynamic>> _messages = [];
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  bool _loading = true;
  String? _conversationId;
  String _otherPartyName = 'Care Specialist';
  bool _isOtherOnline = true;
  bool _isChatClosed = false;
  StreamSubscription? _chatMsgSub;
  StreamSubscription? _aptSub;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  @override
  void dispose() {
    _chatMsgSub?.cancel();
    _aptSub?.cancel();
    if (_conversationId != null) {
      ref.read(realtimeServiceProvider).leaveConversation(_conversationId!);
    }
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initChat() async {
    setState(() => _loading = true);
    final client = ref.read(apiClientProvider);
    final auth = ref.read(authProvider);
    final currentUserId = auth.user?['id']?.toString() ?? '';

    try {
      // 1. Fetch appointment details to determine specialist/patient name and status
      try {
        final aptRes = await client.dio.get('/appointments/${widget.appointmentId}');
        final apt = aptRes.data is Map<String, dynamic> ? aptRes.data : {};
        final status = (apt['status'] ?? '').toString().toLowerCase().trim();
        const activeStatuses = ['accepted', 'on_the_way', 'arrived', 'in_progress'];
        if (status.isNotEmpty && !activeStatuses.contains(status)) {
          _isChatClosed = true;
        }

        final isProvider = auth.user?['role'] == 'provider';
        if (isProvider) {
          _otherPartyName = apt['patientName']?.toString() ?? 'Patient';
        } else {
          _otherPartyName = apt['providerName']?.toString() ?? 'Care Specialist';
        }
      } catch (_) {}

      // 2. Fetch or create conversation for this appointment
      String? convId;
      try {
        final convListRes = await client.dio.get('/chat/conversations');
        final dynamic rawList = convListRes.data;
        final List convs = (rawList is List)
            ? rawList
            : (rawList is Map<String, dynamic> && rawList['data'] is List ? rawList['data'] as List : []);

        for (final c in convs) {
          if (c is Map && c['appointmentId']?.toString() == widget.appointmentId) {
            convId = c['id']?.toString();
            break;
          }
        }
      } catch (_) {}

      if (convId == null) {
        final createRes = await client.dio.post('/chat/conversations', data: {
          'participantIds': [],
          'appointmentId': widget.appointmentId,
        });
        final dynamic createData = createRes.data;
        if (createData is Map) {
          convId = createData['id']?.toString();
        }
      }

      _conversationId = convId ?? 'conv-${widget.appointmentId}';

      // 3. Join Socket room
      ref.read(realtimeServiceProvider).joinConversation(_conversationId!);

      // 4. Fetch historical messages
      try {
        final msgRes = await client.dio.get('/chat/conversations/$_conversationId/messages');
        final dynamic msgData = msgRes.data;
        if (msgData is Map<String, dynamic>) {
          if (msgData['isClosed'] == true || msgData['readOnly'] == true) {
            _isChatClosed = true;
          }
        }

        final List rawMsgs = (msgData is List)
            ? msgData
            : (msgData is Map<String, dynamic> && msgData['data'] is List
                ? msgData['data'] as List
                : (msgData is Map<String, dynamic> && msgData['messages'] is List
                    ? msgData['messages'] as List
                    : []));

        final parsed = rawMsgs.map((m) => _normalizeMessage(m, currentUserId)).toList();
        parsed.sort((a, b) => (a['timestamp'] as DateTime).compareTo(b['timestamp'] as DateTime));

        if (mounted) {
          setState(() {
            _messages.clear();
            _messages.addAll(parsed);
            _loading = false;
          });
          _scrollToBottom();
        }
      } catch (e) {
        if (mounted) setState(() => _loading = false);
      }

      // 5. Listen to live chat stream
      _chatMsgSub = ref.read(realtimeServiceProvider).chatMessagesStream.listen((data) {
        final msgConvId = data['conversationId']?.toString();
        final msgAptId = data['appointmentId']?.toString();
        if (msgConvId == _conversationId || msgAptId == widget.appointmentId) {
          final newMsg = _normalizeMessage(data, currentUserId);
          if (mounted) {
            setState(() {
              final exists = _messages.any((m) => m['id'] == newMsg['id']);
              if (!exists) {
                _messages.add(newMsg);
              }
            });
            _scrollToBottom();
          }
        }
      });

      // 6. Listen to appointment status updates via WebSocket
      _aptSub = ref.read(realtimeServiceProvider).appointmentUpdatesStream.listen((data) {
        final aptId = (data['id'] ?? data['appointmentId'])?.toString();
        if (aptId == widget.appointmentId) {
          final status = (data['status'] ?? '').toString().toLowerCase().trim();
          const activeStatuses = ['accepted', 'on_the_way', 'arrived', 'in_progress'];
          if (mounted) {
            setState(() {
              if (status.isNotEmpty && !activeStatuses.contains(status)) {
                _isChatClosed = true;
              }
            });
          }
        }
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic> _normalizeMessage(dynamic raw, String currentUserId) {
    if (raw is! Map) return {};
    final map = Map<String, dynamic>.from(raw);
    final String senderId = (map['senderId'] ?? (map['sender'] is Map ? map['sender']['id'] : null))?.toString() ?? '';
    final isMe = senderId.isNotEmpty && senderId == currentUserId;
    final timeRaw = map['createdAt'] ?? map['timestamp'] ?? map['time'];
    DateTime dt = DateTime.now();
    if (timeRaw != null) {
      try {
        dt = DateTime.parse(timeRaw.toString());
      } catch (_) {}
    }

    return {
      'id': map['id']?.toString() ?? 'msg-${DateTime.now().millisecondsSinceEpoch}',
      'senderId': senderId,
      'isMe': isMe,
      'text': map['text']?.toString() ?? map['message']?.toString() ?? '',
      'time': DateFormat('hh:mm a').format(dt),
      'timestamp': dt,
      'status': map['status']?.toString() ?? 'sent',
    };
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    if (_isChatClosed) return;

    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final auth = ref.read(authProvider);
    final currentUserId = auth.user?['id']?.toString() ?? '';
    final now = DateTime.now();
    final tempId = 'temp-${now.millisecondsSinceEpoch}';

    final localMsg = {
      'id': tempId,
      'senderId': currentUserId,
      'isMe': true,
      'text': text,
      'time': DateFormat('hh:mm a').format(now),
      'timestamp': now,
      'status': 'sending',
    };

    setState(() {
      _messages.add(localMsg);
    });
    _textController.clear();
    _scrollToBottom();

    try {
      final client = ref.read(apiClientProvider);
      final convId = _conversationId ?? 'conv-${widget.appointmentId}';

      ref.read(realtimeServiceProvider).sendChatMessage(
        conversationId: convId,
        text: text,
      );

      final response = await client.dio.post(
        '/chat/conversations/$convId/messages',
        data: {'text': text},
      );

      if (response.data is Map && mounted) {
        final serverMsg = response.data as Map;
        setState(() {
          final idx = _messages.indexWhere((m) => m['id'] == tempId);
          if (idx >= 0) {
            _messages[idx]['id'] = serverMsg['id']?.toString() ?? tempId;
            _messages[idx]['status'] = 'sent';
          }
        });
      }
    } catch (e) {
      bool sessionClosed = false;
      if (e is DioException) {
        final respData = e.response?.data;
        if (respData is Map &&
            (respData['errorCode'] == 'CHAT_SESSION_CLOSED' || respData['code'] == 'CHAT_SESSION_CLOSED')) {
          sessionClosed = true;
        } else if (e.response?.statusCode == 403) {
          sessionClosed = true;
        }
      }
      if (mounted) {
        setState(() {
          if (sessionClosed) {
            _isChatClosed = true;
            _messages.removeWhere((m) => m['id'] == tempId);
          } else {
            final idx = _messages.indexWhere((m) => m['id'] == tempId);
            if (idx >= 0) {
              _messages[idx]['status'] = 'sent';
            }
          }
        });
        if (sessionClosed) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('This service session has ended. Chat is now closed.'),
              backgroundColor: Colors.amber,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_otherPartyName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _isOtherOnline ? Colors.green : Colors.grey,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  _isOtherOnline ? 'Online' : 'Offline',
                  style: TextStyle(fontSize: 10, color: _isOtherOnline ? Colors.green : Colors.grey),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'Start a conversation with $_otherPartyName',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(20),
                        itemCount: _messages.length,
                        itemBuilder: (context, idx) {
                          final msg = _messages[idx];
                          final isMe = msg['isMe'] == true;

                          return Align(
                            alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              constraints: BoxConstraints(
                                maxWidth: MediaQuery.of(context).size.width * 0.75,
                              ),
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isMe ? theme.primaryColor : Colors.white,
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(12),
                                  topRight: const Radius.circular(12),
                                  bottomLeft: isMe ? const Radius.circular(12) : Radius.zero,
                                  bottomRight: isMe ? Radius.zero : const Radius.circular(12),
                                ),
                                border: isMe ? null : Border.all(color: const Color(0xFFE2E8EE)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.04),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    msg['text'] ?? '',
                                    style: TextStyle(color: isMe ? Colors.white : Colors.black87, fontSize: 13),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        msg['time'] ?? '',
                                        style: TextStyle(color: isMe ? Colors.white70 : const Color(0xFF8A9AAA), fontSize: 9),
                                      ),
                                      if (isMe) ...[
                                        const SizedBox(width: 4),
                                        Icon(
                                          msg['status'] == 'read'
                                              ? Icons.done_all
                                              : (msg['status'] == 'sending' ? Icons.access_time : Icons.done),
                                          size: 12,
                                          color: Colors.white70,
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
          SafeArea(
            child: _isChatClosed
                ? Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      border: Border(top: BorderSide(color: Colors.amber.shade300)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.lock_outline, color: Colors.amber.shade900, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'This service session has ended. Chat is now closed.',
                            style: TextStyle(
                              color: Colors.amber.shade900,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: Colors.grey.shade200)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF4F7F9),
                              borderRadius: BorderRadius.circular(24),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: TextField(
                              controller: _textController,
                              onSubmitted: (_) => _sendMessage(),
                              decoration: const InputDecoration(
                                hintText: 'Type your message...',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: _sendMessage,
                          borderRadius: BorderRadius.circular(24),
                          child: CircleAvatar(
                            radius: 20,
                            backgroundColor: theme.primaryColor,
                            child: const Icon(Icons.send, color: Colors.white, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
