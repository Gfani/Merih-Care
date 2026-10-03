import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/storage/secure_storage.dart';
import '../auth/auth_provider.dart';

class PayoutMethodsScreen extends ConsumerStatefulWidget {
  const PayoutMethodsScreen({super.key});

  @override
  ConsumerState<PayoutMethodsScreen> createState() => _PayoutMethodsScreenState();
}

class _PayoutMethodsScreenState extends ConsumerState<PayoutMethodsScreen> {
  int _selectedTab = 0; // 0: Payout Methods, 1: Payout History
  double _availableBalance = 1650.0;
  String _nextAutoPayoutDate = 'Oct 5';

  List<Map<String, dynamic>> _methods = [];
  List<Map<String, dynamic>> _history = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadSavedData());
  }

  Future<void> _loadSavedData() async {
    try {
      final savedMethodsJson = await SecureStorage.instance.readString('saved_payout_methods');
      if (savedMethodsJson != null && savedMethodsJson.isNotEmpty) {
        final decoded = jsonDecode(savedMethodsJson);
        if (decoded is List && decoded.isNotEmpty) {
          setState(() {
            _methods = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          });
        }
      }
    } catch (_) {}

    if (_methods.isEmpty) {
      final user = ref.read(authProvider).user;
      final holder = (user?['name'] != null && user!['name'].toString().trim().isNotEmpty)
          ? user['name'].toString().trim()
          : 'Healthcare Provider';
      final phone = (user?['phone'] != null && user!['phone'].toString().trim().isNotEmpty)
          ? user['phone'].toString().trim()
          : '+251 91 123 4567';

      setState(() {
        _methods = [
          {
            'id': 'telebirr-1',
            'type': 'telebirr',
            'title': 'Telebirr',
            'holderName': holder,
            'accountNumber': phone,
            'isPrimary': true,
          },
          {
            'id': 'cbe-1',
            'type': 'cbe',
            'title': 'Commercial Bank of Ethiopia',
            'holderName': holder,
            'accountNumber': '1000****4321',
            'isPrimary': false,
          },
        ];
      });
      _saveMethods();
    }

    try {
      final savedHistoryJson = await SecureStorage.instance.readString('saved_payout_history');
      if (savedHistoryJson != null && savedHistoryJson.isNotEmpty) {
        final decoded = jsonDecode(savedHistoryJson);
        if (decoded is List && decoded.isNotEmpty) {
          setState(() {
            _history = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          });
          return;
        }
      }
    } catch (_) {}

    if (_history.isEmpty) {
      setState(() {
        _history = [
          {
            'id': 'tx-101',
            'amount': 'ETB 2,400',
            'date': 'Sep 24, 2026',
            'method': 'Telebirr · +251 91 123 4567',
            'status': 'Completed',
          },
          {
            'id': 'tx-100',
            'amount': 'ETB 1,850',
            'date': 'Sep 17, 2026',
            'method': 'CBE · 1000****4321',
            'status': 'Completed',
          },
        ];
      });
    }
  }

  Future<void> _saveMethods() async {
    try {
      await SecureStorage.instance.writeString('saved_payout_methods', jsonEncode(_methods));
    } catch (_) {}
  }

  Future<void> _saveHistory() async {
    try {
      await SecureStorage.instance.writeString('saved_payout_history', jsonEncode(_history));
    } catch (_) {}
  }

  void _requestInstantPayout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Confirm Instant Payout', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text(
          'Withdraw ETB ${_availableBalance.toStringAsFixed(0)} to your primary method? Funds arrive within minutes.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0D7C6A),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                final primaryMethod = _methods.firstWhere(
                  (m) => m['isPrimary'] == true,
                  orElse: () => _methods.isNotEmpty ? _methods.first : {'title': 'Telebirr', 'accountNumber': ''},
                );
                _history.insert(0, {
                  'id': 'tx-${DateTime.now().millisecondsSinceEpoch}',
                  'amount': 'ETB ${_availableBalance.toStringAsFixed(0)}',
                  'date': 'Just now',
                  'method': '${primaryMethod['title']} · ${primaryMethod['accountNumber']}',
                  'status': 'Processing',
                });
                _availableBalance = 0;
              });
              _saveHistory();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Payout requested successfully.'),
                  backgroundColor: Color(0xFF0D7C6A),
                ),
              );
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  void _showEditMethodModal(Map<String, dynamic> method) {
    String methodType = method['type']?.toString() ?? 'telebirr';
    final nameCtrl = TextEditingController(text: method['holderName']?.toString() ?? '');
    final accountCtrl = TextEditingController(text: method['accountNumber']?.toString() ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (modalCtx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Edit Payout Method',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Telebirr'),
                      selected: methodType == 'telebirr',
                      selectedColor: const Color(0xFFE6F5F2),
                      labelStyle: TextStyle(
                        color: methodType == 'telebirr' ? const Color(0xFF0D7C6A) : Colors.black87,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (_) => setModalState(() => methodType = 'telebirr'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Bank (CBE)'),
                      selected: methodType == 'cbe',
                      selectedColor: const Color(0xFFE6F5F2),
                      labelStyle: TextStyle(
                        color: methodType == 'cbe' ? const Color(0xFF0D7C6A) : Colors.black87,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (_) => setModalState(() => methodType = 'cbe'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Account Holder Name',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accountCtrl,
                keyboardType: methodType == 'telebirr' ? TextInputType.phone : TextInputType.number,
                decoration: InputDecoration(
                  labelText: methodType == 'telebirr' ? 'Telebirr Phone Number' : 'CBE Account Number',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D7C6A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final acc = accountCtrl.text.trim();
                    final name = nameCtrl.text.trim();
                    if (acc.isEmpty || name.isEmpty) return;
                    setState(() {
                      final idx = _methods.indexWhere((m) => m['id'] == method['id']);
                      if (idx != -1) {
                        _methods[idx]['type'] = methodType;
                        _methods[idx]['title'] = methodType == 'telebirr' ? 'Telebirr' : 'Commercial Bank of Ethiopia';
                        _methods[idx]['holderName'] = name;
                        _methods[idx]['accountNumber'] = acc;
                      }
                    });
                    _saveMethods();
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Payout method updated and saved.'),
                        backgroundColor: Color(0xFF0D7C6A),
                      ),
                    );
                  },
                  child: const Text('Save Changes'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddMethodModal() {
    String methodType = 'telebirr';
    final user = ref.read(authProvider).user;
    final defaultName = (user?['name'] != null && user!['name'].toString().trim().isNotEmpty)
        ? user['name'].toString().trim()
        : 'Healthcare Provider';
    final nameCtrl = TextEditingController(text: defaultName);
    final accountCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (modalCtx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Add Payout Method',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Telebirr'),
                      selected: methodType == 'telebirr',
                      selectedColor: const Color(0xFFE6F5F2),
                      labelStyle: TextStyle(
                        color: methodType == 'telebirr' ? const Color(0xFF0D7C6A) : Colors.black87,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (_) => setModalState(() => methodType = 'telebirr'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Bank (CBE)'),
                      selected: methodType == 'cbe',
                      selectedColor: const Color(0xFFE6F5F2),
                      labelStyle: TextStyle(
                        color: methodType == 'cbe' ? const Color(0xFF0D7C6A) : Colors.black87,
                        fontWeight: FontWeight.bold,
                      ),
                      onSelected: (_) => setModalState(() => methodType = 'cbe'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'Account Holder Name',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accountCtrl,
                keyboardType: methodType == 'telebirr' ? TextInputType.phone : TextInputType.number,
                decoration: InputDecoration(
                  labelText: methodType == 'telebirr' ? 'Telebirr Phone Number' : 'CBE Account Number',
                  hintText: methodType == 'telebirr' ? '+251 9...' : '1000...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D7C6A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final acc = accountCtrl.text.trim();
                    if (acc.isEmpty) return;
                    setState(() {
                      _methods.add({
                        'id': 'm-${DateTime.now().millisecondsSinceEpoch}',
                        'type': methodType,
                        'title': methodType == 'telebirr' ? 'Telebirr' : 'Commercial Bank of Ethiopia',
                        'holderName': nameCtrl.text.trim(),
                        'accountNumber': acc,
                        'isPrimary': _methods.isEmpty,
                      });
                    });
                    _saveMethods();
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Payout method added and saved.'),
                        backgroundColor: Color(0xFF0D7C6A),
                      ),
                    );
                  },
                  child: const Text('Save Payout Method'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: Color(0xFF1E293B)),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'Payout Methods',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            Text(
              'Where your earnings are sent',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Green Available Balance Card ─────────────────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D7C6A),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0D7C6A).withOpacity(0.18),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Available for payout',
                          style: TextStyle(fontSize: 13, color: Color(0xFFD1FAE5), fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ETB ${_availableBalance.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                                  style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Next auto-payout: $_nextAutoPayoutDate',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFFA7F3D0)),
                                ),
                              ],
                            ),
                            ElevatedButton(
                              onPressed: _availableBalance > 0 ? _requestInstantPayout : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF0D7C6A),
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                              ),
                              child: const Text(
                                'Request Now',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ─── Segmented Tab Switch: Payout Methods | Payout History ─────────
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _selectedTab = 0),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _selectedTab == 0 ? Colors.white : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                boxShadow: _selectedTab == 0
                                    ? [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.05),
                                          blurRadius: 4,
                                          offset: const Offset(0, 1),
                                        )
                                      ]
                                    : null,
                              ),
                              child: Center(
                                child: Text(
                                  'Payout Methods',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: _selectedTab == 0 ? const Color(0xFF0D7C6A) : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _selectedTab = 1),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _selectedTab == 1 ? Colors.white : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                                boxShadow: _selectedTab == 1
                                    ? [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.05),
                                          blurRadius: 4,
                                          offset: const Offset(0, 1),
                                        )
                                      ]
                                    : null,
                              ),
                              child: Center(
                                child: Text(
                                  'Payout History',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: _selectedTab == 1 ? const Color(0xFF0D7C6A) : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (_selectedTab == 0) ...[
                    // ─── Blue Info Box ─────────────────────────────────────────────────
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Icon(Icons.info_rounded, size: 20, color: Color(0xFF2563EB)),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Earnings are settled weekly. You can also request a payout anytime above.',
                              style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF), height: 1.35),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // ─── Payout Methods List ───────────────────────────────────────────
                    ..._methods.map((m) {
                      final isTelebirr = m['type'] == 'telebirr';
                      final isPrimary = m['isPrimary'] == true;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isTelebirr ? const Color(0xFFFFF1F2) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                isTelebirr ? Icons.phone_android_rounded : Icons.account_balance_rounded,
                                color: isTelebirr ? const Color(0xFFE11D48) : const Color(0xFF475569),
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          m['title'],
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF1E293B),
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (isPrimary) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF0F766E),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text(
                                            'PRIMARY',
                                            style: TextStyle(
                                              fontSize: 9,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '${m['holderName']} · ${m['accountNumber']}',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 20, color: Color(0xFF0D7C6A)),
                              tooltip: 'Edit Method',
                              onPressed: () => _showEditMethodModal(m),
                            ),
                            if (!isPrimary)
                              TextButton(
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  minimumSize: const Size(50, 30),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                onPressed: () {
                                  setState(() {
                                    for (var item in _methods) {
                                      item['isPrimary'] = item['id'] == m['id'];
                                    }
                                  });
                                  _saveMethods();
                                },
                                child: const Text(
                                  'Set primary',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0D7C6A),
                                  ),
                                ),
                              ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFDC2626)),
                              onPressed: () {
                                setState(() {
                                  _methods.removeWhere((item) => item['id'] == m['id']);
                                });
                                _saveMethods();
                              },
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 6),

                    // ─── Payout Schedule Card ──────────────────────────────────────────
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'PAYOUT SCHEDULE',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _buildScheduleRow('Frequency', 'Weekly (every Tuesday)'),
                          const SizedBox(height: 8),
                          _buildScheduleRow('Minimum', 'ETB 500', isBoldValue: true),
                          const SizedBox(height: 8),
                          _buildScheduleRow('Processing', '1–2 business days'),
                          const SizedBox(height: 8),
                          _buildScheduleRow('Tax Withholding', 'Per Ethiopian tax law'),
                        ],
                      ),
                    ),
                  ] else ...[
                    // ─── Payout History Tab ────────────────────────────────────────────
                    ..._history.map((h) => Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    h['amount'],
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    h['method'],
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    h['date'],
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: h['status'] == 'Completed'
                                      ? const Color(0xFFDCFCE7)
                                      : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  h['status'],
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: h['status'] == 'Completed'
                                        ? const Color(0xFF166534)
                                        : const Color(0xFF92400E),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )),
                  ],
                ],
              ),
            ),
          ),

          // ─── Sticky Bottom Action Button ─────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D7C6A),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text(
                    'Add Payout Method',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  onPressed: _showAddMethodModal,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleRow(String label, String value, {bool isBoldValue = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isBoldValue ? FontWeight.bold : FontWeight.w500,
            color: const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }
}
