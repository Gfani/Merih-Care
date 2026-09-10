import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'auth_provider.dart';
import 'widgets/google_logo.dart';

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
  bool _uploadingCv = false;
  bool _uploadingLicense = false;
  bool _uploadingId = false;

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

  static const Set<String> _reputableConsumerDomains = {
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'ymail.com',
    'myyahoo.com',
    'rocketmail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'windowslive.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'proton.me',
    'protonmail.com',
    'zoho.com',
    'aol.com',
    'mail.com',
    'gmx.com',
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
          _uploadingCv = true;
        });

        List<int>? bytes = file.bytes;
        if (bytes == null && file.path != null) {
          try {
            bytes = await File(file.path!).readAsBytes();
          } catch (e) {
            debugPrint('[SIGNUP] Error reading CV file bytes from disk: $e');
          }
        }

        if (bytes != null) {
          final uploadedKey = await ref.read(authProvider.notifier).uploadCredentialDocument(
                file.name,
                bytes,
              );
          if (uploadedKey != null && mounted) {
            setState(() {
              _cvUrlController.text = uploadedKey;
              _uploadingCv = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('CV uploaded: ${file.name}')),
            );
          } else if (mounted) {
            setState(() {
              _uploadingCv = false;
              _attachedCvName = null;
              _cvUrlController.text = '';
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to upload CV to server. Please try again.')),
            );
          }
        } else if (mounted) {
          setState(() {
            _uploadingCv = false;
            _attachedCvName = null;
            _cvUrlController.text = '';
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _uploadingCv = false);
      debugPrint('[SIGNUP] Error picking CV file: $e');
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
          _uploadingLicense = true;
        });

        List<int>? bytes = file.bytes;
        if (bytes == null && file.path != null) {
          try {
            bytes = await File(file.path!).readAsBytes();
          } catch (e) {
            debugPrint('[SIGNUP] Error reading license file bytes from disk: $e');
          }
        }

        if (bytes != null) {
          final uploadedKey = await ref.read(authProvider.notifier).uploadCredentialDocument(
                file.name,
                bytes,
              );
          if (uploadedKey != null && mounted) {
            setState(() {
              _licenseDocController.text = uploadedKey;
              _uploadingLicense = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Medical license uploaded: ${file.name}')),
            );
          } else if (mounted) {
            setState(() {
              _uploadingLicense = false;
              _attachedLicenseName = null;
              _licenseDocController.text = '';
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to upload license to server. Please try again.')),
            );
          }
        } else if (mounted) {
          setState(() {
            _uploadingLicense = false;
            _attachedLicenseName = null;
            _licenseDocController.text = '';
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _uploadingLicense = false);
      debugPrint('[SIGNUP] Error picking license file: $e');
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
          _uploadingId = true;
        });

        List<int>? bytes = file.bytes;
        if (bytes == null && file.path != null) {
          try {
            bytes = await File(file.path!).readAsBytes();
          } catch (e) {
            debugPrint('[SIGNUP] Error reading ID file bytes from disk: $e');
          }
        }

        if (bytes != null) {
          final uploadedKey = await ref.read(authProvider.notifier).uploadCredentialDocument(
                file.name,
                bytes,
              );
          if (uploadedKey != null && mounted) {
            setState(() {
              _idDocController.text = uploadedKey;
              _uploadingId = false;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('ID document uploaded: ${file.name}')),
            );
          } else if (mounted) {
            setState(() {
              _uploadingId = false;
              _attachedIdName = null;
              _idDocController.text = '';
            });
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to upload ID to server. Please try again.')),
            );
          }
        } else if (mounted) {
          setState(() {
            _uploadingId = false;
            _attachedIdName = null;
            _idDocController.text = '';
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _uploadingId = false);
      debugPrint('[SIGNUP] Error picking ID file: $e');
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
                    final parts = normalized.split('@');
                    if (parts.length != 2) return 'Invalid email format';
                    final localPart = parts.first;
                    final domain = parts.last;

                    if (localPart.length < 3) {
                      return 'Email username must be at least 3 characters';
                    }
                    if (RegExp(r'^([a-z0-9])\1{2,}$').hasMatch(localPart)) {
                      return 'Email appears fake. Please use a real personal or professional email.';
                    }
                    const dummyMailboxes = {'asdf', 'qwerty', 'test', 'fake', 'temp', 'dummy', 'none', 'null'};
                    if (dummyMailboxes.contains(localPart)) {
                      return 'Please use your real personal or professional email.';
                    }

                    if (_disposableDomains.contains(domain)) {
                      return 'Disposable or temporary email addresses are not permitted';
                    }

                    // Direct match for major reputable consumer providers
                    if (_reputableConsumerDomains.contains(domain)) {
                      return null;
                    }

                    final domainParts = domain.split('.');
                    if (domainParts.length < 2 || domainParts.last.length < 2) {
                      return 'Email domain must have a valid top-level domain';
                    }
                    final domainName = domainParts.first;
                    final tld = domainParts.last;

                    // Block single-letter or two-letter fake domains (e.g. f.com, g.com, ab.com)
                    if (domainName.length < 3) {
                      return 'The domain "$domain" is not recognized. Please use a real email (e.g. Gmail, Yahoo, Outlook) or your hospital/university domain.';
                    }
                    if (RegExp(r'^\d+$').hasMatch(domainName) || RegExp(r'^([a-z0-9])\1{2,}$').hasMatch(domainName)) {
                      return 'The domain "$domain" is invalid. Please use a real email provider.';
                    }
                    const dummyDomains = {'fake', 'test', 'example', 'temp', 'dummy', 'trash', 'sample', 'mailinator', 'none', 'bogus'};
                    if (dummyDomains.contains(domainName)) {
                      return 'Please use a real, permanent email address.';
                    }

                    const validInstitutionalTlds = {
                      'et', 'edu', 'gov', 'org', 'int', 'health', 'hospital', 'clinic', 'care', 'med', 'ac.uk', 'edu.et', 'gov.et'
                    };
                    final fullTld = domainParts.sublist(1).join('.');
                    if (validInstitutionalTlds.contains(tld) || validInstitutionalTlds.contains(fullTld)) {
                      return null;
                    }

                    if (['com', 'net', 'co', 'io'].contains(tld) && domainName.length >= 3) {
                      return null;
                    }

                    return 'Please use a reputable email provider (such as Gmail, Yahoo, Outlook, iCloud) or a verified institutional domain.';
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
                          isUploading: _uploadingCv,
                        ),
                        const SizedBox(height: 8),

                        // Medical License Document
                        _buildUploadCard(
                          title: 'Medical License Certificate',
                          fileName: _attachedLicenseName,
                          required: false,
                          icon: Icons.assignment_turned_in_outlined,
                          onTap: _pickLicenseFile,
                          isUploading: _uploadingLicense,
                        ),
                        const SizedBox(height: 8),

                        // National ID
                        _buildUploadCard(
                          title: 'National ID or Passport',
                          fileName: _attachedIdName,
                          required: false,
                          icon: Icons.contact_page_outlined,
                          onTap: _pickIdFile,
                          isUploading: _uploadingId,
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: (_loading || _uploadingCv || _uploadingLicense || _uploadingId)
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            if (_role == 'provider') {
                              if (_uploadingCv || _uploadingLicense || _uploadingId) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please wait for document uploads to finish.')),
                                );
                                return;
                              }
                              if (_cvUrlController.text.trim().isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please upload your CV / Resume before registering.')),
                                );
                                return;
                              }
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
                                    'cvUrl': _cvUrlController.text.trim(),
                                    'licenseDocumentUrl': _licenseDocController.text.trim(),
                                    'idDocumentUrl': _idDocController.text.trim(),
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
                              final verified = await _showEmailVerificationDialog(
                                context,
                                _emailController.text.trim(),
                              );
                              if (!verified || !mounted) return;

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
                const SizedBox(height: 18),

                // Divider OR
                Row(
                  children: [
                    Expanded(child: Divider(color: Colors.grey.shade300, thickness: 1)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'OR',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: Colors.grey.shade300, thickness: 1)),
                  ],
                ),
                const SizedBox(height: 18),

                // Continue with Google Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: _loading
                        ? null
                        : () async {
                            final Map<String, dynamic>? providerData = _role == 'provider'
                                ? {
                                    'title': _title,
                                    'specialty': _specialty,
                                    'licenseNumber': _licenseNumberController.text.trim(),
                                    'experience': int.tryParse(_experienceController.text.trim()) ?? 0,
                                    'education': _educationController.text.trim(),
                                    'hospitalAffiliation': _hospitalAffiliationController.text.trim(),
                                    'cvUrl': _cvUrlController.text.trim(),
                                    'licenseDocumentUrl': _licenseDocController.text.trim(),
                                    'idDocumentUrl': _idDocController.text.trim(),
                                  }
                                : null;

                            setState(() => _loading = true);
                            final result = await ref.read(authProvider.notifier).signInWithGoogle(
                                  role: _role,
                                  providerData: providerData,
                                );
                            if (mounted) setState(() => _loading = false);
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
                                          'Your Google sign-in was successful. Your provider application is pending administrator verification.',
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
                          },
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      backgroundColor: Colors.white,
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        GoogleLogo(size: 20),
                        SizedBox(width: 12),
                        Text(
                          'Sign up with Google',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                      ],
                    ),
                  ),
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
    bool isUploading = false,
  }) {
    final attached = fileName != null && !isUploading;
    return InkWell(
      onTap: isUploading ? null : onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: attached ? const Color(0xFFE6FFFA) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: attached ? const Color(0xFF319795) : (isUploading ? const Color(0xFF0F766E) : const Color(0xFFCBD5E1)),
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
                    isUploading
                        ? 'Uploading document to server...'
                        : (attached ? fileName : 'Tap to attach document (PDF/DOCX)'),
                    style: TextStyle(
                      fontSize: 11,
                      color: attached || isUploading ? const Color(0xFF0F766E) : const Color(0xFF94A3B8),
                      fontWeight: isUploading ? FontWeight.w600 : FontWeight.normal,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isUploading)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF0F766E),
                ),
              )
            else
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

  Future<bool> _showEmailVerificationDialog(BuildContext context, String email) async {
    final otpCtrl = TextEditingController();
    bool loading = false;
    String? errorMsg;
    String? successMsg = 'A 6-digit verification code was sent to your email. Valid for 5 minutes.';
    bool isVerified = false;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final theme = Theme.of(context);

          return AlertDialog(
            title: Row(
              children: [
                Icon(Icons.mark_email_read_outlined, color: theme.primaryColor),
                const SizedBox(width: 8),
                const Text('Verify Your Email'),
              ],
            ),
            content: SingleChildScrollView(
              child: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorMsg != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          errorMsg!,
                          style: const TextStyle(color: Color(0xFF991B1B), fontSize: 12),
                        ),
                      ),
                    if (successMsg != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          border: Border.all(color: const Color(0xFF86EFAC)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          successMsg!,
                          style: const TextStyle(color: Color(0xFF166534), fontSize: 12),
                        ),
                      ),
                    Text(
                      'To prevent fake registrations, please enter the 6-digit code sent to $email.',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      '• This security OTP expires in 5 minutes.',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F766E)),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: otpCtrl,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 6),
                      decoration: const InputDecoration(
                        labelText: '6-Digit Code',
                        hintText: '123456',
                        prefixIcon: Icon(Icons.security),
                        counterText: '',
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Didn\'t receive the code?',
                          style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                        ),
                        TextButton(
                          onPressed: loading
                              ? null
                              : () async {
                                  setDialogState(() {
                                    loading = true;
                                    errorMsg = null;
                                    successMsg = null;
                                  });
                                  final res = await ref.read(authProvider.notifier).resendEmailVerification(email);
                                  setDialogState(() {
                                    loading = false;
                                    if (res['success'] == true) {
                                      successMsg = res['message'] ?? 'New OTP sent. Valid for 5 minutes.';
                                    } else {
                                      errorMsg = res['message'] ?? 'Failed to resend code';
                                    }
                                  });
                                },
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(50, 30),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Resend Code', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: loading ? null : () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: loading
                    ? null
                    : () async {
                        final otp = otpCtrl.text.trim();
                        if (otp.length != 6) {
                          setDialogState(() => errorMsg = 'Please enter the 6-digit code');
                          return;
                        }

                        setDialogState(() {
                          loading = true;
                          errorMsg = null;
                        });

                        final res = await ref.read(authProvider.notifier).confirmEmailVerification(email, otp);
                        setDialogState(() => loading = false);

                        if (res['success'] == true) {
                          isVerified = true;
                          if (ctx.mounted) Navigator.of(ctx).pop();
                        } else {
                          setDialogState(() {
                            errorMsg = res['message'] ?? 'Invalid or expired OTP code (expires in 5 minutes)';
                          });
                        }
                      },
                child: loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Verify & Activate'),
              ),
            ],
          );
        },
      ),
    );

    return isVerified;
  }
}
