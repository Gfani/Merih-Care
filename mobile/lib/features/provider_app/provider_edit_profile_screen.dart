import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../core/theme/app_theme.dart';
import '../auth/auth_provider.dart';

class ProviderEditProfileScreen extends ConsumerStatefulWidget {
  const ProviderEditProfileScreen({super.key});

  @override
  ConsumerState<ProviderEditProfileScreen> createState() => _ProviderEditProfileScreenState();
}

class _ProviderEditProfileScreenState extends ConsumerState<ProviderEditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _titleController;
  late TextEditingController _feeController;
  late TextEditingController _experienceController;
  late TextEditingController _bioController;

  String? _providerId;
  bool _available = true;
  bool _verified = false;
  double _rating = 5.0;
  int _reviewCount = 0;
  List<String> _selectedServices = [];
  bool _loading = true;
  bool _saving = false;

  final List<String> _availableServices = [
    'Doctor Visit',
    'Home Nursing',
    'Physiotherapy',
    'Wound Care',
    'Maternal Care',
    'Medication Assist',
    'Elderly Care',
    'Telemedicine',
  ];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _titleController = TextEditingController();
    _feeController = TextEditingController();
    _experienceController = TextEditingController();
    _bioController = TextEditingController();

    Future.microtask(() => _loadProviderProfile());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _titleController.dispose();
    _feeController.dispose();
    _experienceController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _loadProviderProfile() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/providers/me');
      final dynamic raw = response.data;
      final Map<String, dynamic>? data = (raw is Map<String, dynamic> && raw.containsKey('data') && raw['data'] is Map<String, dynamic>)
          ? raw['data'] as Map<String, dynamic>
          : (raw is Map<String, dynamic> ? raw : null);

      if (data != null && mounted) {
        setState(() {
          _providerId = data['id']?.toString();
          _nameController.text = (data['name'] ?? ref.read(authProvider).user?['name'] ?? '').toString();
          _titleController.text = (data['title'] ?? 'General Practitioner (MD)').toString();
          _feeController.text = ((data['pricePerVisit'] ?? 800) as num).toString();
          _experienceController.text = ((data['experience'] ?? 5) as num).toString();
          _bioController.text = (data['bio'] ?? 'Dedicated healthcare provider delivering personalized medical care at home.').toString();
          _available = data['available'] == true || data['available'] == 1;
          _verified = data['verified'] == true || data['verified'] == 1;
          _rating = (data['rating'] as num?)?.toDouble() ?? 5.0;
          _reviewCount = (data['reviewCount'] as num?)?.toInt() ?? 0;

          final rawServices = data['services'];
          if (rawServices is List) {
            _selectedServices = rawServices.map((s) => s.toString()).toList();
          } else {
            _selectedServices = ['Doctor Visit', 'Home Nursing'];
          }
          _loading = false;
        });
        return;
      }
    } catch (e) {
      print('[PROVIDER_PROFILE] Error loading provider profile: $e');
    }

    // Fallback to auth user state
    final user = ref.read(authProvider).user ?? {};
    if (mounted) {
      setState(() {
        _nameController.text = (user['name'] ?? 'Healthcare Provider').toString();
        _titleController.text = 'General Practitioner (MD)';
        _feeController.text = '800';
        _experienceController.text = '5';
        _bioController.text = 'Dedicated healthcare provider delivering home medical care in Addis Ababa.';
        _selectedServices = ['Doctor Visit', 'Home Nursing'];
        _loading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      final client = ref.read(apiClientProvider);
      final fee = double.tryParse(_feeController.text.trim()) ?? 800.0;
      final exp = int.tryParse(_experienceController.text.trim()) ?? 0;

      final updatePayload = {
        'name': _nameController.text.trim(),
        'title': _titleController.text.trim(),
        'pricePerVisit': fee,
        'experience': exp,
        'bio': _bioController.text.trim(),
        'available': _available,
        'services': _selectedServices,
      };

      await client.dio.put('/providers/me', data: updatePayload);

      // Refresh auth profile to sync state
      final profileRes = await client.dio.get('/auth/profile');
      final dynamic pData = profileRes.data;
      if (pData is Map<String, dynamic> && mounted) {
        ref.read(authProvider.notifier).updateUser(pData);
      }

      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Professional profile updated successfully!'),
            backgroundColor: AppTheme.primaryColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppTheme.surfaceColor,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final initial = _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'P';

    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        title: const Text('Professional Profile'),
        actions: [
          if (_providerId != null)
            TextButton.icon(
              onPressed: () => context.push('/provider/$_providerId'),
              icon: const Icon(Icons.visibility_outlined, size: 18, color: Colors.white),
              label: const Text('Preview', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 32,
                      backgroundColor: AppTheme.primaryColor.withValues(alpha: 0.1),
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  _nameController.text,
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              if (_verified)
                                const Icon(Icons.verified, color: AppTheme.primaryColor, size: 16),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _titleController.text,
                            style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _available
                                      ? AppTheme.primaryColor.withValues(alpha: 0.1)
                                      : Colors.grey.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: _available ? AppTheme.primaryColor : Colors.grey,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      _available ? 'ONLINE' : 'OFFLINE',
                                      style: TextStyle(
                                        color: _available ? AppTheme.primaryColor : Colors.grey,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '★ $_rating ($_reviewCount visits)',
                                style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Text('DISPATCH AVAILABILITY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 8),
              Card(
                child: SwitchListTile(
                  title: const Text('Available for Immediate Booking', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Turn on to receive patient house visit dispatches in real-time', style: TextStyle(fontSize: 11)),
                  value: _available,
                  activeThumbColor: AppTheme.primaryColor,
                  onChanged: (val) => setState(() => _available = val),
                ),
              ),

              const SizedBox(height: 24),
              const Text('CLINICAL CREDENTIALS & SPECIALTY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _nameController,
                        decoration: const InputDecoration(
                          labelText: 'Display Name',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter name' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _titleController,
                        decoration: const InputDecoration(
                          labelText: 'Professional Title / Specialty',
                          hintText: 'e.g. General Practitioner (MD), Home Nurse (BSc)',
                          prefixIcon: Icon(Icons.medical_services_outlined),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter title' : null,
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _feeController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Visit Fee (ETB)',
                                prefixIcon: Icon(Icons.payments_outlined),
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter fee' : null,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: TextFormField(
                              controller: _experienceController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Experience (Years)',
                                prefixIcon: Icon(Icons.timeline_outlined),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),
              const Text('SERVICES OFFERED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _availableServices.map((service) {
                      final selected = _selectedServices.contains(service);
                      return FilterChip(
                        label: Text(service, style: TextStyle(fontSize: 12, color: selected ? AppTheme.primaryColor : AppTheme.textPrimary)),
                        selected: selected,
                        selectedColor: AppTheme.primaryColor.withValues(alpha: 0.15),
                        checkmarkColor: AppTheme.primaryColor,
                        onSelected: (val) {
                          setState(() {
                            if (val) {
                              _selectedServices.add(service);
                            } else {
                              _selectedServices.remove(service);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                ),
              ),

              const SizedBox(height: 24),
              const Text('PROFESSIONAL BIOGRAPHY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textMuted)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextFormField(
                    controller: _bioController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      hintText: 'Share your background, medical qualifications, and approach to patient home care...',
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _saving ? null : _saveProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _saving
                      ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Save Professional Profile', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
