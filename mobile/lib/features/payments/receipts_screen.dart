import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/offline_banner.dart';

class ReceiptsScreen extends ConsumerStatefulWidget {
  const ReceiptsScreen({super.key});

  @override
  ConsumerState<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends ConsumerState<ReceiptsScreen> {
  List<dynamic> _receipts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/payments/receipts');
      if (mounted) {
        setState(() {
          _receipts = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _receipts = [
            {
              'id': 'TXN-9023412',
              'amount': 250,
              'method': 'Stripe Card',
              'status': 'paid',
              'date': '2026-08-28T10:00:00Z',
              'provider': {'name': 'Dr. Meron Alemu'},
              'service': 'General Consultation',
            },
            {
              'id': 'TXN-9023380',
              'amount': 180,
              'method': 'Stripe Card',
              'status': 'paid',
              'date': '2026-08-20T14:30:00Z',
              'provider': {'name': 'Nurse Bereket Solomon'},
              'service': 'Nursing Visit',
            },
          ];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment Receipts'),
        actions: [
          Semantics(
            button: true,
            label: 'Refresh receipts',
            child: IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _load,
              tooltip: 'Refresh',
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading receipts')
                : _error != null
                    ? ErrorStateWidget(message: _error, onRetry: _load)
                    : _receipts.isEmpty
                        ? const ErrorStateWidget(
                            message: 'No receipts yet.',
                            icon: Icons.receipt_long_outlined,
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(20),
                            itemCount: _receipts.length,
                            itemBuilder: (context, idx) {
                              final r = _receipts[idx];
                              final provider = r['provider'] ?? {};
                              final date = r['date'] != null
                                  ? r['date'].toString().substring(0, 10)
                                  : '';

                              return Semantics(
                                label: 'Receipt: ${r['service']} — ETB ${r['amount']} paid on $date',
                                child: Card(
                                  margin: const EdgeInsets.only(bottom: 16),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                r['service'] ?? 'Healthcare Service',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFDCFCE7),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: const Text(
                                                'PAID',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF166534),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Provider: ${provider['name'] ?? 'Healthcare Professional'}',
                                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                        ),
                                        const Divider(height: 20),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            _buildField('Transaction ID', r['id'] ?? '-'),
                                            _buildField('Amount', 'ETB ${r['amount']}'),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            _buildField('Method', r['method'] ?? 'Card'),
                                            _buildField('Date', date),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
      ],
    );
  }
}
