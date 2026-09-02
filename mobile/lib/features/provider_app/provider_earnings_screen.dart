import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_providers.dart';
import '../auth/auth_provider.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/offline_banner.dart';

class ProviderEarningsScreen extends ConsumerStatefulWidget {
  const ProviderEarningsScreen({super.key});

  @override
  ConsumerState<ProviderEarningsScreen> createState() => _ProviderEarningsScreenState();
}

class _ProviderEarningsScreenState extends ConsumerState<ProviderEarningsScreen> {
  Map<String, dynamic>? _earningsData;
  bool _loading = true;
  String? _error;
  bool _requestingPayout = false;

  @override
  void initState() {
    super.initState();
    _loadEarnings();
  }

  Future<void> _loadEarnings() async {
    setState(() { _loading = true; _error = null; });
    try {
      final auth = ref.read(authProvider);
      final providerId = auth.user?['id'] ?? 'p-1';
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/earnings/$providerId');
      if (mounted) {
        setState(() {
          _earningsData = response.data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load earnings data. Please check your connection.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _requestPayout() async {
    final balance = _earningsData?['balance'] ?? 0.0;
    if (balance <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No balance available to request payout.'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _requestingPayout = true);

    try {
      final auth = ref.read(authProvider);
      final providerId = auth.user?['id'] ?? 'p-1';
      final client = ref.read(apiClientProvider);
      await client.dio.post('/payouts/request', data: {
        'providerId': providerId,
        'amount': balance,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout request submitted!'), backgroundColor: Colors.teal),
        );
        _loadEarnings();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit payout request. Please try again later.'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _requestingPayout = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = _earningsData?['balance'] ?? 0.0;
    final totalEarnings = _earningsData?['totalEarnings'] ?? 0.0;
    final payoutsPending = _earningsData?['payoutsPending'] ?? 0.0;
    final history = _earningsData?['history'] as List<dynamic>? ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Earnings & Payouts')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading earnings')
                : _error != null
                    ? ErrorStateWidget(message: _error, onRetry: _loadEarnings)
                    : SingleChildScrollView(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Main balance card
                            Semantics(
                              label: 'Current balance: ETB $balance',
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF0D7C6A), Color(0xFF0F9B85)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF0D7C6A).withOpacity(0.3),
                                      blurRadius: 12,
                                      offset: const Offset(0, 6),
                                    )
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('AVAILABLE BALANCE', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 8),
                                    Text('ETB $balance', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 24),
                                    Semantics(
                                      button: true,
                                      label: 'Request payout',
                                      child: ElevatedButton(
                                        onPressed: balance <= 0 || _requestingPayout ? null : _requestPayout,
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.white,
                                          foregroundColor: const Color(0xFF0D7C6A),
                                          minimumSize: const Size(double.infinity, 48),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        child: _requestingPayout
                                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Color(0xFF0D7C6A), strokeWidth: 2))
                                            : const Text('Request Payout'),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            // Quick stats
                            Row(
                              children: [
                                Expanded(
                                  child: _buildStatCard('Total Earned', 'ETB $totalEarnings', Icons.monetization_on_outlined),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: _buildStatCard('Pending Payouts', 'ETB $payoutsPending', Icons.hourglass_bottom_rounded),
                                ),
                              ],
                            ),
                            const SizedBox(height: 32),
                            const Text('Payout History', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 16),
                            if (history.isEmpty)
                              const Text('No payout history found.', style: TextStyle(color: Color(0xFF8A9AAA)))
                            else
                              ...history.map((h) {
                                final isPending = h['status'] == 'pending';
                                return Semantics(
                                  label: 'Payout request for ETB ${h['amount']}. Status is ${h['status']}. Requested on ${h['date']}',
                                  child: Card(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    child: ListTile(
                                      leading: CircleAvatar(
                                        backgroundColor: isPending ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                                        child: Icon(
                                          isPending ? Icons.hourglass_bottom_rounded : Icons.check_circle_outline_rounded,
                                          color: isPending ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                                        ),
                                      ),
                                      title: Text('ETB ${h['amount']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                      subtitle: Text(h['date'] ?? '', style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 12)),
                                      trailing: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isPending ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          isPending ? 'PENDING' : 'COMPLETED',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            color: isPending ? const Color(0xFFB45309) : const Color(0xFF15803D),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF64748B), size: 20),
          const SizedBox(height: 12),
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }
}
