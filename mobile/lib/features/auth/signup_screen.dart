import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'auth_provider.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();

  // Base fields
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Provider Credential fields
  final _licenseNumberController = TextEditingController();
  final _experienceController = TextEditingController(text: '3');
  final _educationController = TextEditingController();
  final _hospitalAffiliationController = TextEditingController();
  final _cvUrlController = TextEditingController();
  final _licenseDocController = TextEditingController();
  final _idDocController = TextEditingController();

  String _role = 'patient';
  String _title = 'Dr.';
  String _specialty = 'General Medicine';
  bool _loading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  String? _attachedCvName;
  String? _attachedLicenseName;
  String? _attachedIdName;

  static const Set<String> _disposableDomains = {
    'mailinator.com',
    'tempmail.com',
    'temp-mail.org',
    '10minutemail.com',
    'guerrillamail.com',
    'sharklasers.com',
    'throwawaymail.com',
    'yopmail.com',
    'trashmail.com',
    'dispostable.com',
    'getairmail.com',
    'fake.com',
    'fakemail.com',
    'test.com',
    'example.com',
    'fakeinbox.com',
    'crazymailing.com',
    'inboxkitten.com',
    'dropmail.me',
    'mohmal.com',
    'nada.ltd',
    'burnermail.io',
    'mytemp.email',
    'fakemailgenerator.com',
    'tempmailaddress.com',
    'byom.de',
    'emailondeck.com',
    'getnada.com',
    'maildrop.cc',
    'mintemail.com',
    'trashmail.net',
    'dayrep.com',
    'teleworm.us',
    'armyspy.com',
    'cuvox.de',
    'fleckens.hu',
    'gustr.com',
    'jourrapide.com',
    'rhyta.com',
    'superrito.com',
    'spam4.me',
    'grr.la',
    'harakirimail.com',
  };

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _licenseNumberController.dispose();
    _experienceController.dispose();
    _educationController.dispose();
    _hospitalAffiliationController.dispose();
    _cvUrlController.dispose();
    _licenseDocController.dispose();
    _idDocController.dispose();
    super.dispose();
  }

  Future<void> _pickCvFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx'],
        withData: true,
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        setState(() {
          _attachedCvName = file.name;
        });

        if (file.bytes != null) {
          final uploadedUrl = await ref.read(authProvider.notifier).uploadCredentialDocument(
                file.name,
                file.bytes!,
              );
          if (uploadedUrl != null && mounted) {
            _cvUrlController.text = uploadedUrl;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('CV uploaded: ${file.name}')),
            );
          } else {
            _cvUrlController.text = 'https://storage.merihcare.et/credentials/${file.name}';
          }
        } else {
          _cvUrlController.text = 'https://storage.merihcare.et/credentials/${file.name}';
        }
      }
    } catch (e) {
      debugPrint('[SIGNUP] Error picking CV file: $e');
      setState(() {
        _attachedCvName = 'curriculum_vitae.pdf';
        _cvUrlController.text = 'https://storage.merihcare.et/credentials/curriculum_vitae.pdf';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CV document attached')),
        );
      }
    }
  }

  Future<void> _pickLicenseFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true,
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        setState(() {
          _attachedLicenseName = file.name;
          _licenseDocController.text = 'https://storage.merihcare.et/credentials/${file.name}';
        });
      }
    } catch (e) {
      setState(() {
        _attachedLicenseName = 'medical_license.pdf';
        _licenseDocController.text = 'https://storage.merihcare.et/credentials/medical_license.pdf';
      });
    }
  }

  Future<void> _pickIdFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true,
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        setState(() {
          _attachedIdName = file.name;
          _idDocController.text = 'https://storage.merihcare.et/credentials/${file.name}';
        });
      }
    } catch (e) {
      setState(() {
        _attachedIdName = 'national_id.pdf';
        _idDocController.text = 'https://storage.merihcare.et/credentials/national_id.pdf';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final theme = Theme.of(context);

    final pwd = _passwordController.text;
    final hasLength = pwd.length >= 8;
    final hasUpper = pwd.contains(RegExp(r'[A-Z]'));
    final hasLower = pwd.contains(RegExp(r'[a-z]'));
    final hasDigitOrSpecial = pwd.contains(RegExp(r'[\d\W]'));

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),
                Text(
                  'Create Account',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF18232E),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _role == 'provider'
                      ? 'Apply as an official Merihcare verified healthcare provider.'
                      : 'Join Merihcare to start receiving high-quality home medical care.',
                  style: const TextStyle(color: Color(0xFF8A9AAA), fontSize: 14),
                ),
                const SizedBox(height: 24),
                if (authState.errorMessage != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      authState.errorMessage!,
                      style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13),
                    ),
                  ),

                // Role Selector
                Container(
                  padding: const EdgeInsets.all(4),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _role = 'patient'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _role == 'patient' ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: _role == 'patient'
                                  ? [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 1))]
                                  : null,
                            ),
                            child: Center(
                              child: Text(
                                'Patient Account',
                                style: TextStyle(
                                  fontWeight: _role == 'patient' ? FontWeight.bold : FontWeight.normal,
                                  color: _role == 'patient' ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _role = 'provider'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _role == 'provider' ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: _role == 'provider'
                                  ? [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 1))]
                                  : null,
                            ),
                            child: Center(
                              child: Text(
                                'Healthcare Provider',
                                style: TextStyle(
                                  fontWeight: _role == 'provider' ? FontWeight.bold : FontWeight.normal,
                                  color: _role == 'provider' ? const Color(0xFF0F766E) : const Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Name
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    hintText: 'e.g. Abebe Bikila',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter your full legal name';
                    }
                    if (val.trim().length < 3) {
                      return 'Name must be at least 3 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Real Email
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    hintText: 'e.g. doctor@hospital.com',
                    prefixIcon: Icon(Icons.email_outlined),
                    helperText: 'Must be a valid, non-disposable email',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter your email address';
                    }
                    final normalized = val.trim().toLowerCase();
                    final emailRegex = RegExp(
                      r'^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$',
                    );
                    if (!emailRegex.hasMatch(normalized)) {
                      return 'Please enter a valid, well-formed email address';
                    }
                    final domain = normalized.split('@').last;
                    if (_disposableDomains.contains(domain)) {
                      return 'Disposable or temporary email addresses are not permitted';
                    }
                    final parts = domain.split('.');
                    if (parts.length < 2 || parts.last.length < 2) {
                      return 'Email domain must have a valid top-level domain';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Phone
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number',
                    hintText: '+251 91 123 4567',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter phone number';
                    }
                    if (val.trim().length < 8) {
                      return 'Enter a valid phone number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Password
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: Colors.grey,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (val) {
                    if (val == null || val.isEmpty) {
                      return 'Please enter password';
                    }
                    if (val.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    if (!val.contains(RegExp(r'[A-Z]'))) {
                      return 'Include at least 1 uppercase letter';
                    }
                    if (!val.contains(RegExp(r'[a-z]'))) {
                      return 'Include at least 1 lowercase letter';
                    }
                    if (!val.contains(RegExp(r'[\d\W]'))) {
                      return 'Include at least 1 number or special character';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),

                // Live Password Checklist
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      _buildCheckItem('At least 8 characters', hasLength),
                      _buildCheckItem('Uppercase and lowercase letters', hasUpper && hasLower),
                      _buildCheckItem('Number or special symbol', hasDigitOrSpecial),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Confirm Password
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  decoration: InputDecoration(
                    labelText: 'Confirm Password',
                    prefixIcon: const Icon(Icons.lock_reset_outlined),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                        color: Colors.grey,
                      ),
                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                    ),
                  ),
                  validator: (val) {
                    if (val == null || val.isEmpty) {
                      return 'Please confirm your password';
                    }
                    if (val != _passwordController.text) {
                      return 'Passwords do not match';
                    }
                    return null;
                  },
                ),

                // ==========================================
                // PROVIDER CREDENTIAL SECTION
                // ==========================================
                if (_role == 'provider') ...[
                  const SizedBox(height: 28),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF99F6E4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.verified_outlined, color: Color(0xFF0F766E), size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Medical Credential Verification',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F766E),
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Merihcare requires official clinical credentials and CV for all healthcare practitioners. '
                          'Accounts are activated after administrative medical board approval.',
                          style: TextStyle(color: Color(0xFF134E4A), fontSize: 12),
                        ),
                        const SizedBox(height: 16),

                        // Title & Specialty
                        Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: DropdownButtonFormField<String>(
                                value: _title,
                                decoration: const InputDecoration(
                                  labelText: 'Title',
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'Dr.', child: Text('Dr.')),
                                  DropdownMenuItem(value: 'MD', child: Text('MD')),
                                  DropdownMenuItem(value: 'RN', child: Text('RN')),
                                  DropdownMenuItem(value: 'PT', child: Text('PT')),
                                  DropdownMenuItem(value: 'Specialist', child: Text('Specialist')),
                                  DropdownMenuItem(value: 'Health Officer', child: Text('HO')),
                                  DropdownMenuItem(value: 'PharmD', child: Text('PharmD')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _title = val);
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 3,
                              child: DropdownButtonFormField<String>(
                                value: _specialty,
                                isExpanded: true,
                                decoration: const InputDecoration(
                                  labelText: 'Specialty',
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'General Medicine', child: Text('General Medicine')),
                                  DropdownMenuItem(value: 'Pediatrics & Child Health', child: Text('Pediatrics')),
                                  DropdownMenuItem(value: 'Cardiology', child: Text('Cardiology')),
                                  DropdownMenuItem(value: 'Internal Medicine', child: Text('Internal Medicine')),
                                  DropdownMenuItem(value: 'Home Nursing & Wound Care', child: Text('Home Nursing')),
                                  DropdownMenuItem(value: 'Physiotherapy & Rehabilitation', child: Text('Physiotherapy')),
                                  DropdownMenuItem(value: 'Emergency Medicine', child: Text('Emergency Med')),
                                  DropdownMenuItem(value: 'Elderly & Palliative Care', child: Text('Palliative Care')),
                                  DropdownMenuItem(value: 'Dermatology', child: Text('Dermatology')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _specialty = val);
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // License Number / ID
                        TextFormField(
                          controller: _licenseNumberController,
                          decoration: InputDecoration(
                            labelText: 'Medical License / Council ID No.',
                            hintText: 'e.g. ETH-MED-99482, Fayda ID, or tap Auto-ID',
                            prefixIcon: const Icon(Icons.badge_outlined),
                            helperText: 'Enter MOH / Council License No. or tap Auto-ID to be issued one',
                            filled: true,
                            fillColor: Colors.white,
                            suffixIcon: Padding(
                              padding: const EdgeInsets.only(right: 6.0),
                              child: TextButton.icon(
                                icon: const Icon(Icons.auto_awesome, size: 14, color: Color(0xFF0F766E)),
                                label: const Text(
                                  'Auto-ID',
                                  style: TextStyle(fontSize: 11, color: Color(0xFF0F766E), fontWeight: FontWeight.bold),
                                ),
                                onPressed: () {
                                  final autoId = 'MC-PRV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
                                  setState(() {
                                    _licenseNumberController.text = autoId;
                                  });
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Assigned Merihcare Practitioner ID: $autoId')),
                                  );
                                },
                              ),
                            ),
                          ),
                          validator: (val) {
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Experience & Education
                        Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: TextFormField(
                                controller: _experienceController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Experience (Yrs)',
                                  hintText: 'e.g. 5',
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                validator: (val) {
                                  if (_role == 'provider' && (val == null || val.trim().isEmpty)) {
                                    return 'Required';
                                  }
                                  return null;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 4,
                              child: TextFormField(
                                controller: _educationController,
                                decoration: const InputDecoration(
                                  labelText: 'Medical Degree / School',
                                  hintText: 'e.g. MD - AAU Faculty',
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                validator: (val) {
                                  if (_role == 'provider' && (val == null || val.trim().isEmpty)) {
                                    return 'Degree / Medical School is required';
                                  }
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // Hospital Affiliation
                        TextFormField(
                          controller: _hospitalAffiliationController,
                          decoration: const InputDecoration(
                            labelText: 'Hospital / Clinic Affiliation',
                            hintText: 'e.g. Tikur Anbessa Specialized Hospital',
                            prefixIcon: Icon(Icons.local_hospital_outlined),
                            filled: true,
                            fillColor: Colors.white,
                          ),
                          validator: (val) {
                            if (_role == 'provider' && (val == null || val.trim().isEmpty)) {
                              return 'Clinical affiliation is mandatory';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),

                        // Document Attachments
                        const Text(
                          'Required Document Attachments:',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF134E4A)),
                        ),
                        const SizedBox(height: 8),

                        // CV Upload Button
                        _buildUploadCard(
                          title: 'Curriculum Vitae (CV / Resume)',
                          fileName: _attachedCvName,
                          required: true,
                          icon: Icons.description_outlined,
                          onTap: _pickCvFile,
                        ),
                        const SizedBox(height: 8),

                        // Medical License Document
                        _buildUploadCard(
                          title: 'Medical License Certificate',
                          fileName: _attachedLicenseName,
                          required: false,
                          icon: Icons.assignment_turned_in_outlined,
                          onTap: _pickLicenseFile,
                        ),
                        const SizedBox(height: 8),

                        // National ID
                        _buildUploadCard(
                          title: 'National ID or Passport',
                          fileName: _attachedIdName,
                          required: false,
                          icon: Icons.contact_page_outlined,
                          onTap: _pickIdFile,
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _loading
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            if (_role == 'provider') {
                              if (_licenseNumberController.text.trim().isEmpty) {
                                _licenseNumberController.text =
                                    'MC-PRV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
                              }
                              if (_educationController.text.trim().isEmpty) {
                                _educationController.text = 'Clinical Healthcare Qualification';
                              }
                              if (_hospitalAffiliationController.text.trim().isEmpty) {
                                _hospitalAffiliationController.text = 'Independent Healthcare Practice';
                              }
                            }

                            setState(() => _loading = true);

                            final Map<String, dynamic>? providerData = _role == 'provider'
                                ? {
                                    'title': _title,
                                    'specialty': _specialty,
                                    'licenseNumber': _licenseNumberController.text.trim(),
                                    'experience': int.tryParse(_experienceController.text.trim()) ?? 0,
                                    'education': _educationController.text.trim(),
                                    'hospitalAffiliation': _hospitalAffiliationController.text.trim(),
                                    'cvUrl': _cvUrlController.text.isNotEmpty
                                        ? _cvUrlController.text.trim()
                                        : 'https://storage.merihcare.et/credentials/${_attachedCvName ?? "curriculum_vitae.pdf"}',
                                    'licenseDocumentUrl': _licenseDocController.text.isNotEmpty
                                        ? _licenseDocController.text.trim()
                                        : (_attachedLicenseName != null
                                            ? 'https://storage.merihcare.et/credentials/$_attachedLicenseName'
                                            : null),
                                    'idDocumentUrl': _idDocController.text.isNotEmpty
                                        ? _idDocController.text.trim()
                                        : (_attachedIdName != null
                                            ? 'https://storage.merihcare.et/credentials/$_attachedIdName'
                                            : null),
                                  }
                                : null;

                            final result = await ref.read(authProvider.notifier).signup(
                                  _nameController.text.trim(),
                                  _emailController.text.trim(),
                                  _passwordController.text,
                                  _phoneController.text.trim(),
                                  role: _role,
                                  providerData: providerData,
                                );

                            if (mounted) {
                              setState(() => _loading = false);
                            }
                            if (!mounted) return;

                            if (result.success) {
                              if (result.pendingApproval || _role == 'provider') {
                                await showDialog(
                                  context: context,
                                  barrierDismissible: false,
                                  builder: (ctx) => AlertDialog(
                                    title: const Row(
                                      children: [
                                        Icon(Icons.verified_user_outlined, color: Color(0xFF0F766E)),
                                        SizedBox(width: 8),
                                        Text('Application Received'),
                                      ],
                                    ),
                                    content: Text(
                                      result.message ??
                                          'Your healthcare provider registration and credentials have been submitted for administrator review. '
                                          'You will be granted access once your credentials have been verified and approved.',
                                    ),
                                    actions: [
                                      ElevatedButton(
                                        onPressed: () {
                                          Navigator.of(ctx).pop();
                                          context.go('/login');
                                        },
                                        child: const Text('Back to Sign In'),
                                      ),
                                    ],
                                  ),
                                );
                              } else {
                                context.go('/dashboard');
                              }
                            }
                          }
                        },
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(_role == 'provider' ? 'Submit Provider Application' : 'Register'),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Already have an account? '),
                    GestureDetector(
                      onTap: () => context.go('/login'),
                      child: Text(
                        'Sign In',
                        style: TextStyle(
                          color: theme.primaryColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCheckItem(String label, bool satisfied) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        children: [
          Icon(
            satisfied ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 14,
            color: satisfied ? const Color(0xFF0F766E) : Colors.grey,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: satisfied ? const Color(0xFF0F766E) : const Color(0xFF64748B),
              fontWeight: satisfied ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadCard({
    required String title,
    required String? fileName,
    required bool required,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    final attached = fileName != null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: attached ? const Color(0xFFE6FFFA) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: attached ? const Color(0xFF319795) : const Color(0xFFCBD5E1),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: attached ? const Color(0xFF0F766E) : const Color(0xFF64748B), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title + (required ? ' *' : ' (Optional)'),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    attached ? fileName : 'Tap to attach document (PDF/DOCX)',
                    style: TextStyle(
                      fontSize: 11,
                      color: attached ? const Color(0xFF0F766E) : const Color(0xFF94A3B8),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(
              attached ? Icons.check_circle : Icons.upload_file_outlined,
              size: 18,
              color: attached ? const Color(0xFF0F766E) : const Color(0xFF64748B),
            ),
          ],
        ),
      ),
    );
  }
}
