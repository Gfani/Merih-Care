import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'auth_provider.dart';
import 'widgets/google_logo.dart';
import '../../core/storage/secure_storage.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _savedPhone;

  @override
  void initState() {
    super.initState();
    _loadSavedCredentials();
  }

  Future<void> _loadSavedCredentials() async {
    final email = await SecureStorage.instance.readLastEmail();
    final phone = await SecureStorage.instance.readLastPhone();
    if (mounted) {
      setState(() {
        if (email != null && email.isNotEmpty && _emailController.text.isEmpty) {
          _emailController.text = email;
        }
        _savedPhone = phone;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 48),
                Text(
                  'Welcome Back',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF18232E),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Sign in to access your premium medical care services.',
                  style: TextStyle(color: Color(0xFF8A9AAA)),
                ),
                const SizedBox(height: 32),
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
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter email';
                    }
                    if (!val.contains('@')) {
                      return 'Invalid email format';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  validator: (val) {
                    if (val == null || val.isEmpty) {
                      return 'Please enter password';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => _showForgotPasswordDialog(context),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(50, 30),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Forgot Password?',
                      style: TextStyle(
                        color: theme.primaryColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loading
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            setState(() => _loading = true);
                            final ok = await ref.read(authProvider.notifier).login(
                                  _emailController.text.trim(),
                                  _passwordController.text,
                                );
                            if (mounted) {
                              setState(() => _loading = false);
                            }
                            if (ok && mounted) {
                              final user = ref.read(authProvider).user;
                              final role = user?['role'];
                              if (role == 'provider') {
                                context.go('/provider-dashboard');
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
                      : const Text('Sign In'),
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
                            setState(() => _loading = true);
                            final result = await ref.read(authProvider.notifier).signInWithGoogle();
                            if (mounted) setState(() => _loading = false);
                            if (!mounted) return;

                            if (result.success) {
                              if (result.pendingApproval) {
                                await showDialog(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Row(
                                      children: [
                                        Icon(Icons.hourglass_top_rounded, color: Color(0xFF0D7C6A)),
                                        SizedBox(width: 8),
                                        Text('Pending Approval'),
                                      ],
                                    ),
                                    content: Text(result.message ?? 'Your account is pending administrator approval.'),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
                                    ],
                                  ),
                                );
                              } else {
                                final user = ref.read(authProvider).user;
                                final role = user?['role'];
                                if (role == 'provider') {
                                  context.go('/provider-dashboard');
                                } else {
                                  context.go('/dashboard');
                                }
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
                          'Continue with Google',
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
                    const Text("Don't have an account? "),
                    GestureDetector(
                      onTap: () => context.go('/signup'),
                      child: Text(
                        'Register Now',
                        style: TextStyle(
                          color: theme.primaryColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showForgotPasswordDialog(BuildContext context) async {
    final emailCtrl = TextEditingController(text: _emailController.text.trim());
    final phoneCtrl = TextEditingController(text: _savedPhone ?? '');
    final otpCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final confirmPassCtrl = TextEditingController();

    int step = 1; // 1: request, 2: verify
    String selectedChannel = 'sms'; // 'sms' or 'email'
    String activeIdentifier = '';
    String maskedDestination = '';
    bool loading = false;
    String? errorMsg;
    String? successMsg;

    // Check SecureStorage for saved phone
    if (phoneCtrl.text.isEmpty) {
      final p = await SecureStorage.instance.readLastPhone();
      if (p != null && p.isNotEmpty) {
        phoneCtrl.text = p;
        _savedPhone = p;
      }
    }

    // If email is present and phone is still empty, automatically lookup phone in backend
    if (phoneCtrl.text.isEmpty && emailCtrl.text.isNotEmpty) {
      final contact = await ref.read(authProvider.notifier).lookupContact(emailCtrl.text);
      if (contact != null && contact['phone'] != null && contact['phone']!.isNotEmpty) {
        phoneCtrl.text = contact['phone']!;
        _savedPhone = contact['phone']!;
        SecureStorage.instance.writeLastPhone(contact['phone']!);
      }
    }

    if (!context.mounted) return;

    showDialog(
      context: context,
      barrierDismissible: !loading,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final theme = Theme.of(context);

          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              children: [
                Icon(
                  step == 1
                      ? (selectedChannel == 'sms' ? Icons.sms_outlined : Icons.lock_reset)
                      : Icons.security,
                  color: theme.primaryColor,
                ),
                const SizedBox(width: 8),
                Text(
                  step == 1 ? 'Reset Password' : 'Enter 5-Min Code',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (step == 1) ...[
                      // Channel toggle between SMS and Email
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3F4F6),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: loading
                                    ? null
                                    : () async {
                                        setDialogState(() => selectedChannel = 'sms');
                                        if (phoneCtrl.text.trim().isEmpty) {
                                          final p = await SecureStorage.instance.readLastPhone() ?? _savedPhone;
                                          if (p != null && p.isNotEmpty) {
                                            setDialogState(() => phoneCtrl.text = p);
                                          } else if (emailCtrl.text.trim().isNotEmpty) {
                                            final contact = await ref.read(authProvider.notifier).lookupContact(emailCtrl.text.trim());
                                            if (contact != null && contact['phone'] != null && contact['phone']!.isNotEmpty) {
                                              setDialogState(() => phoneCtrl.text = contact['phone']!);
                                              _savedPhone = contact['phone']!;
                                              SecureStorage.instance.writeLastPhone(contact['phone']!);
                                            }
                                          }
                                        }
                                      },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: selectedChannel == 'sms' ? Colors.white : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: selectedChannel == 'sms'
                                        ? const [BoxShadow(color: Color(0x0D000000), blurRadius: 4, offset: Offset(0, 2))]
                                        : null,
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.sms,
                                        size: 16,
                                        color: selectedChannel == 'sms' ? theme.primaryColor : const Color(0xFF6B7280),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Via SMS',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: selectedChannel == 'sms' ? FontWeight.bold : FontWeight.normal,
                                          color: selectedChannel == 'sms' ? theme.primaryColor : const Color(0xFF4B5563),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: loading
                                    ? null
                                    : () async {
                                        setDialogState(() => selectedChannel = 'email');
                                        if (emailCtrl.text.trim().isEmpty) {
                                          final e = await SecureStorage.instance.readLastEmail() ?? _emailController.text.trim();
                                          if (e.isNotEmpty) {
                                            setDialogState(() => emailCtrl.text = e);
                                          } else if (phoneCtrl.text.trim().isNotEmpty) {
                                            final contact = await ref.read(authProvider.notifier).lookupContact(phoneCtrl.text.trim());
                                            if (contact != null && contact['email'] != null && contact['email']!.isNotEmpty) {
                                              setDialogState(() => emailCtrl.text = contact['email']!);
                                              SecureStorage.instance.writeLastEmail(contact['email']!);
                                            }
                                          }
                                        }
                                      },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: selectedChannel == 'email' ? Colors.white : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: selectedChannel == 'email'
                                        ? const [BoxShadow(color: Color(0x0D000000), blurRadius: 4, offset: Offset(0, 2))]
                                        : null,
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.email,
                                        size: 16,
                                        color: selectedChannel == 'email' ? theme.primaryColor : const Color(0xFF6B7280),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Via Email',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: selectedChannel == 'email' ? FontWeight.bold : FontWeight.normal,
                                          color: selectedChannel == 'email' ? theme.primaryColor : const Color(0xFF4B5563),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

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

                    if (step == 1) ...[
                      Text(
                        selectedChannel == 'sms'
                            ? 'Enter your registered mobile phone number. We will send a 6-digit OTP via SMS.'
                            : 'Enter your account email. We will send a secure 6-digit OTP code.',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 14),
                      if (selectedChannel == 'sms')
                        TextField(
                          controller: phoneCtrl,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Phone Number',
                            hintText: '0911223344 or +251911223344',
                            prefixIcon: Icon(Icons.phone_android),
                          ),
                        )
                      else
                        TextField(
                          controller: emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Email Address',
                            hintText: 'name@example.com',
                            prefixIcon: Icon(Icons.email_outlined),
                          ),
                        ),
                    ] else ...[
                      Text(
                        'Enter the 6-digit code sent via ${selectedChannel.toUpperCase()} to $maskedDestination.',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: otpCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 6),
                        decoration: const InputDecoration(
                          labelText: '6-Digit OTP Code',
                          hintText: '123456',
                          prefixIcon: Icon(Icons.security),
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: newPassCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'New Password (min 8 chars, 1 uppercase, 1 number)',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: confirmPassCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Confirm New Password',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Didn\'t receive it?',
                            style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                          Row(
                            children: [
                              TextButton(
                                onPressed: loading
                                    ? null
                                    : () async {
                                        setDialogState(() {
                                          loading = true;
                                          errorMsg = null;
                                          successMsg = null;
                                        });
                                        final res = await ref.read(authProvider.notifier).requestPasswordReset(
                                          activeIdentifier,
                                          channel: 'sms',
                                        );
                                        setDialogState(() {
                                          loading = false;
                                          if (res['success'] == true) {
                                            selectedChannel = 'sms';
                                            maskedDestination = res['destination'] ?? activeIdentifier;
                                            successMsg = res['message'] ?? 'SMS OTP sent. Valid for 5 minutes.';
                                          } else {
                                            errorMsg = res['message'] ?? 'Failed to resend SMS';
                                          }
                                        });
                                      },
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(40, 30),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text('Resend SMS', style: TextStyle(fontSize: 12)),
                              ),
                              const Text(' | ', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                              TextButton(
                                onPressed: loading
                                    ? null
                                    : () async {
                                        setDialogState(() {
                                          loading = true;
                                          errorMsg = null;
                                          successMsg = null;
                                        });
                                        final res = await ref.read(authProvider.notifier).requestPasswordReset(
                                          activeIdentifier,
                                          channel: 'email',
                                        );
                                        setDialogState(() {
                                          loading = false;
                                          if (res['success'] == true) {
                                            selectedChannel = 'email';
                                            maskedDestination = res['destination'] ?? activeIdentifier;
                                            successMsg = res['message'] ?? 'Email OTP sent. Valid for 5 minutes.';
                                          } else {
                                            errorMsg = res['message'] ?? 'Failed to resend Email';
                                          }
                                        });
                                      },
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(40, 30),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text('Resend Email', style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: loading ? null : () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              if (step == 1)
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () async {
                          final identifier = selectedChannel == 'sms'
                              ? phoneCtrl.text.trim()
                              : emailCtrl.text.trim();

                          if (selectedChannel == 'sms') {
                            if (identifier.length < 9) {
                              setDialogState(() => errorMsg = 'Please enter a valid phone number (e.g. 0911223344)');
                              return;
                            }
                          } else {
                            if (identifier.isEmpty || !identifier.contains('@')) {
                              setDialogState(() => errorMsg = 'Please enter a valid email address');
                              return;
                            }
                          }

                          setDialogState(() {
                            loading = true;
                            errorMsg = null;
                            successMsg = null;
                          });

                          final res = await ref.read(authProvider.notifier).requestPasswordReset(
                            identifier,
                            channel: selectedChannel,
                          );

                          setDialogState(() {
                            loading = false;
                            if (res['success'] == true) {
                              step = 2;
                              activeIdentifier = identifier;
                              maskedDestination = res['destination'] ?? identifier;
                              successMsg = res['message'] ?? 'OTP code sent. Valid for 5 minutes.';
                            } else {
                              errorMsg = res['message'] ?? 'Failed to send OTP';
                            }
                          });
                        },
                  child: loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(selectedChannel == 'sms' ? 'Send SMS Code' : 'Send Email Code'),
                )
              else
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () async {
                          final otp = otpCtrl.text.trim();
                          final newPass = newPassCtrl.text;
                          final confirmPass = confirmPassCtrl.text;

                          if (otp.length != 6) {
                            setDialogState(() => errorMsg = 'Please enter the full 6-digit OTP');
                            return;
                          }
                          if (newPass.length < 8) {
                            setDialogState(() => errorMsg = 'Password must be at least 8 characters');
                            return;
                          }
                          if (newPass != confirmPass) {
                            setDialogState(() => errorMsg = 'Passwords do not match');
                            return;
                          }

                          setDialogState(() {
                            loading = true;
                            errorMsg = null;
                            successMsg = null;
                          });

                          final res = await ref.read(authProvider.notifier).confirmPasswordReset(
                                activeIdentifier,
                                otp,
                                newPass,
                              );

                          setDialogState(() => loading = false);

                          if (res['success'] == true) {
                            if (ctx.mounted) Navigator.of(ctx).pop();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: const Color(0xFF166534),
                                  content: Text(res['message'] ?? 'Password reset successfully! You can now log in.'),
                                ),
                              );
                            }
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
                      : const Text('Reset Password'),
                ),
            ],
          );
        },
      ),
    );
  }
}
