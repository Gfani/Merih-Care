import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/offline_banner.dart';
import 'widgets/provider_bottom_nav_bar.dart';

class ProviderRequestsScreen extends ConsumerStatefulWidget {
  const ProviderRequestsScreen({super.key});

  @override
  ConsumerState<ProviderRequestsScreen> createState() => _ProviderRequestsScreenState();
}

class _ProviderRequestsScreenState extends ConsumerState<ProviderRequestsScreen> {
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;
  String? _error;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _loadRequests();
    _subscribeRealtime();
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  void _subscribeRealtime() {
    final realtime = ref.read(realtimeServiceProvider);
    _realtimeSub = realtime.serviceRequestsStream.listen((event) {
      if (mounted) {
        _loadRequests(silent: true);
      }
    });
  }

  Future<void> _loadRequests({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final client = ref.read(apiClientProvider);
      // Query pending appointments/requests available for this provider
      final response = await client.dio.get('/appointments', queryParameters: {
        'status': 'pending',
        'role': 'provider',
      });
      final dynamic raw = response.data;
      final List list = (raw is List)
          ? raw
          : (raw is Map<String, dynamic> && raw['data'] is List ? raw['data'] as List : []);

      final parsed = list.map<Map<String, dynamic>>((item) {
        final map = item is Map<String, dynamic> ? item : <String, dynamic>{};
        final patient = map['patient'] is Map<String, dynamic> ? map['patient'] as Map<String, dynamic> : {};
        return {
          'id': map['id']?.toString() ?? '',
          'title': map['service']?.toString() ?? 'Home Medical Care',
          'price': 'ETB ${map['amount'] ?? 800}',
          'patientName': patient['name'] ?? map['patientName'] ?? 'Patient',
          'date': map['date']?.toString() ?? map['createdAt']?.toString().substring(0, 10) ?? '',
          'distance': map['distance'] != null ? '${map['distance']} km' : 'Within 5 km',
          'note': map['notes'] ?? map['clinicalNote'] ?? 'Care request requested by patient.',
          'timeReceived': map['time'] ?? 'Just now',
          'avatarUrl': patient['avatar'] ?? map['patientAvatar'],
          'appointmentData': map,
        };
      }).toList();

      if (mounted) {
        setState(() {
          _requests = parsed;
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('[REQUESTS] Error loading provider requests: $e');
      if (mounted) {
        setState(() {
          _requests = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            const Text(
              'Requests',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            if (_requests.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_requests.length} new',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            tooltip: 'Refresh requests',
            onPressed: () => _loadRequests(),
          ),
        ],
      ),
      bottomNavigationBar: ProviderBottomNavBar(
        currentIndex: 1,
        pendingRequestsCount: _requests.length,
      ),
      body: SafeArea(
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: _loading
                  ? const LoadingStateWidget(label: 'Checking for incoming patient requests...')
                  : _error != null
                      ? ErrorStateWidget(message: _error!, onRetry: () => _loadRequests())
                      : _requests.isEmpty
                          ? _buildEmptyState()
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                              itemCount: _requests.length,
                              itemBuilder: (context, index) {
                                final req = _requests[index];
                                return _buildRequestCard(req);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFFE6F5F2),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.inbox_outlined,
                size: 40,
                color: Color(0xFF0D7C6A),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'No Pending Requests',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'You are online and ready to receive requests. When patients in your area request care, they will appear here in real-time.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _loadRequests(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D7C6A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Refresh Feed'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> req) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFE6F5F2),
                backgroundImage: req['avatarUrl'] != null && req['avatarUrl'].toString().isNotEmpty
                    ? NetworkImage(req['avatarUrl'])
                    : null,
                child: req['avatarUrl'] == null || req['avatarUrl'].toString().isEmpty
                    ? Text(
                        req['patientName'].isNotEmpty ? req['patientName'][0].toUpperCase() : 'P',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0D7C6A)),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            req['title'],
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E293B),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          req['price'],
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0D7C6A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      req['patientName'],
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Meta: Date + Distance
          Row(
            children: [
              const Icon(Icons.calendar_month_outlined, size: 15, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Text(
                req['date'],
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(width: 16),
              const Icon(Icons.location_on_outlined, size: 15, color: Color(0xFFEF4444)),
              const SizedBox(width: 4),
              Text(
                req['distance'],
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Clinical Note
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Text(
              req['note'],
              style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
            ),
          ),
          const SizedBox(height: 10),

          // Time Received & Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                req['timeReceived'],
                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              ),
              InkWell(
                onTap: () {
                  context.push('/provider/active-request', extra: req['appointmentData'] ?? req);
                },
                child: const Row(
                  children: [
                    Text(
                      'View Details',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0D7C6A),
                      ),
                    ),
                    SizedBox(width: 2),
                    Icon(Icons.chevron_right, size: 16, color: Color(0xFF0D7C6A)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
