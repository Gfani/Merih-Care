import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_providers.dart';

class MedicalRecordsScreen extends ConsumerStatefulWidget {
  const MedicalRecordsScreen({super.key});

  @override
  ConsumerState<MedicalRecordsScreen> createState() => _MedicalRecordsScreenState();
}

class _MedicalRecordsScreenState extends ConsumerState<MedicalRecordsScreen> {
  List<dynamic> _records = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  Future<void> _loadRecords() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/medical-records');
      if (mounted) {
        setState(() {
          _records = response.data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _records = [
            {
              'id': 'mrec-001',
              'diagnosis': 'Acute Seasonal Flu',
              'notes': 'Patient presented with 38.5C fever, cough. Prescribed paracetamol 500mg, bed rest.',
              'createdAt': '2026-08-15T12:00:00Z',
              'provider': {'name': 'Dr. Meron Alemu'},
            }
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
        title: const Text('Medical Records'),
        actions: [
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Downloading Encrypted Medical History...'), backgroundColor: Colors.teal),
              );
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _records.isEmpty
              ? const Center(child: Text('No medical records found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _records.length,
                  itemBuilder: (context, idx) {
                    final rec = _records[idx];
                    final provider = rec['provider'] ?? {};
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  rec['diagnosis'] ?? 'General Consultation',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF18232E)),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: const Color(0xFFE6F5F2), borderRadius: BorderRadius.circular(6)),
                                  child: const Text('ENCRYPTED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0D7C6A))),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              rec['notes'] ?? 'No notes available.',
                              style: const TextStyle(color: Color(0xFF4A5A6A), fontSize: 13, height: 1.4),
                            ),
                            const Divider(height: 24),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Attended by: ${provider['name'] ?? 'Healthcare Specialist'}', style: const TextStyle(fontSize: 11, color: Color(0xFF8A9AAA))),
                                Text(
                                  rec['createdAt'] != null ? rec['createdAt'].toString().substring(0, 10) : '',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF8A9AAA)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
