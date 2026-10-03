import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/storage/secure_storage.dart';

class MedicalInformationScreen extends ConsumerStatefulWidget {
  const MedicalInformationScreen({super.key});

  @override
  ConsumerState<MedicalInformationScreen> createState() => _MedicalInformationScreenState();
}

class _MedicalInformationScreenState extends ConsumerState<MedicalInformationScreen> {
  String _bloodType = 'A+';
  String _allergies = 'Penicillin, Dust';
  String _chronicConditions = 'Hypertension (managed)';
  String _currentMedications = 'Amlodipine 5mg · Once daily';
  List<Map<String, String>> _customRecords = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadMedicalInfo());
  }

  Future<void> _loadMedicalInfo() async {
    try {
      final savedJson = await SecureStorage.instance.readString('patient_medical_info');
      if (savedJson != null && savedJson.isNotEmpty) {
        final decoded = jsonDecode(savedJson);
        if (decoded is Map<String, dynamic>) {
          setState(() {
            if (decoded['bloodType'] != null) _bloodType = decoded['bloodType'].toString();
            if (decoded['allergies'] != null) _allergies = decoded['allergies'].toString();
            if (decoded['chronicConditions'] != null) _chronicConditions = decoded['chronicConditions'].toString();
            if (decoded['currentMedications'] != null) _currentMedications = decoded['currentMedications'].toString();
            if (decoded['customRecords'] is List) {
              _customRecords = (decoded['customRecords'] as List)
                  .map((e) => Map<String, String>.from(e as Map))
                  .toList();
            }
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _saveMedicalInfo() async {
    final payload = {
      'bloodType': _bloodType,
      'allergies': _allergies,
      'chronicConditions': _chronicConditions,
      'currentMedications': _currentMedications,
      'customRecords': _customRecords,
    };
    try {
      await SecureStorage.instance.writeString('patient_medical_info', jsonEncode(payload));
    } catch (_) {}
  }

  void _showEditDialog(String title, String currentValue, ValueChanged<String> onSaved) {
    final controller = TextEditingController(text: currentValue);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Edit $title', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Enter $title',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0D7C6A),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              final val = controller.text.trim();
              if (val.isNotEmpty) {
                onSaved(val);
                _saveMedicalInfo();
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$title updated and saved.'),
                    backgroundColor: const Color(0xFF0D7C6A),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showAddInfoDialog() {
    String category = 'Emergency Contact';
    final valCtrl = TextEditingController();

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
                'Add Medical Information',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: category,
                decoration: InputDecoration(
                  labelText: 'Category',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: const [
                  DropdownMenuItem(value: 'Emergency Contact', child: Text('Emergency Contact')),
                  DropdownMenuItem(value: 'Past Surgeries', child: Text('Past Surgeries')),
                  DropdownMenuItem(value: 'Health Insurance', child: Text('Health Insurance')),
                  DropdownMenuItem(value: 'Dietary Restrictions', child: Text('Dietary Restrictions')),
                  DropdownMenuItem(value: 'Family Medical History', child: Text('Family Medical History')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => category = val);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: valCtrl,
                decoration: InputDecoration(
                  labelText: 'Details',
                  hintText: 'Enter details...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 18),
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
                    final text = valCtrl.text.trim();
                    if (text.isEmpty) return;
                    setState(() {
                      _customRecords.add({'category': category, 'details': text});
                    });
                    _saveMedicalInfo();
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$category added to your health record.'),
                        backgroundColor: const Color(0xFF0D7C6A),
                      ),
                    );
                  },
                  child: const Text('Add to Health Profile'),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textCol = isDark ? Colors.white : const Color(0xFF1E293B);
    final borderCol = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
    final scaffoldBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: cardBg,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new, size: 18, color: textCol),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Medical Information',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: textCol,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          children: [
            // ─── Blue Info Box ─────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E3A5F) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: isDark ? const Color(0xFF2563EB) : const Color(0xFFBFDBFE)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_rounded, size: 22, color: Color(0xFF2563EB)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Private & Secure',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF1E40AF),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Your medical information is encrypted and only shared with your confirmed provider during active appointments.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: isDark ? const Color(0xFF93C5FD) : const Color(0xFF1E40AF),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ─── Blood Type Card ───────────────────────────────────────────────
            _buildMedicalCard(
              icon: Icons.water_drop_rounded,
              iconColor: const Color(0xFFE11D48),
              iconBgColor: const Color(0xFFFFF1F2),
              title: 'Blood Type',
              value: _bloodType,
              cardBg: cardBg,
              textCol: textCol,
              borderCol: borderCol,
              onEdit: () => _showEditDialog('Blood Type', _bloodType, (v) => setState(() => _bloodType = v)),
            ),

            // ─── Allergies Card ────────────────────────────────────────────────
            _buildMedicalCard(
              icon: Icons.warning_amber_rounded,
              iconColor: const Color(0xFFD97706),
              iconBgColor: const Color(0xFFFEF3C7),
              title: 'Allergies',
              value: _allergies,
              cardBg: cardBg,
              textCol: textCol,
              borderCol: borderCol,
              onEdit: () => _showEditDialog('Allergies', _allergies, (v) => setState(() => _allergies = v)),
            ),

            // ─── Chronic Conditions Card ───────────────────────────────────────
            _buildMedicalCard(
              icon: Icons.assignment_outlined,
              iconColor: const Color(0xFFEA580C),
              iconBgColor: const Color(0xFFFFEDD5),
              title: 'Chronic Conditions',
              value: _chronicConditions,
              cardBg: cardBg,
              textCol: textCol,
              borderCol: borderCol,
              onEdit: () => _showEditDialog(
                'Chronic Conditions',
                _chronicConditions,
                (v) => setState(() => _chronicConditions = v),
              ),
            ),

            // ─── Current Medications Card ──────────────────────────────────────
            _buildMedicalCard(
              icon: Icons.medication_rounded,
              iconColor: const Color(0xFFE11D48),
              iconBgColor: const Color(0xFFFFF1F2),
              title: 'Current Medications',
              value: _currentMedications,
              cardBg: cardBg,
              textCol: textCol,
              borderCol: borderCol,
              onEdit: () => _showEditDialog(
                'Current Medications',
                _currentMedications,
                (v) => setState(() => _currentMedications = v),
              ),
            ),

            // ─── Custom Added Records ──────────────────────────────────────────
            ..._customRecords.asMap().entries.map((entry) {
              final idx = entry.key;
              final rec = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: borderCol),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE6F5F2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.bookmark_added_outlined, color: Color(0xFF0D7C6A), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            rec['category'] ?? 'Health Detail',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            rec['details'] ?? '',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: textCol,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFDC2626)),
                      onPressed: () {
                        setState(() {
                          _customRecords.removeAt(idx);
                        });
                        _saveMedicalInfo();
                      },
                    ),
                  ],
                ),
              );
            }),

            const SizedBox(height: 12),

            // ─── Add Medical Information Button ────────────────────────────────
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF0D7C6A),
                  side: const BorderSide(color: Color(0xFF0D7C6A), width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _showAddInfoDialog,
                child: const Text(
                  '+ Add Medical Information',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMedicalCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String value,
    required Color cardBg,
    required Color textCol,
    required Color borderCol,
    required VoidCallback onEdit,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderCol),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: textCol,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF0D7C6A),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(40, 30),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: onEdit,
            child: const Text(
              'Edit',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
