import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'auth_provider.dart';
import 'widgets/google_logo.dart';

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

  void _showForgotPasswordDialog(BuildContext context) {
    final emailCtrl = TextEditingController(text: _emailController.text.trim());
    final otpCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final confirmPassCtrl = TextEditingController();

    int step = 1; // 1: request, 2: verify
    bool loading = false;
    String? errorMsg;
    String? successMsg;

    showDialog(
      context: context,
      barrierDismissible: !loading,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final theme = Theme.of(context);

          return AlertDialog(
            title: Row(
              children: [
                Icon(
                  step == 1 ? Icons.lock_reset : Icons.mark_email_read_outlined,
                  color: theme.primaryColor,
                ),
                const SizedBox(width: 8),
                Text(step == 1 ? 'Forgot Password' : 'Enter 5-Min OTP'),
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
                    if (step == 1) ...[
                      const Text(
                        'Enter your account email. We will send a secure 6-digit OTP valid for exactly 5 minutes.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          prefixIcon: Icon(Icons.email_outlined),
                        ),
                      ),
                    ] else ...[
                      Text(
                        'Enter the 6-digit code sent to ${emailCtrl.text.trim()}. This OTP expires in 5 minutes.',
                        style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: otpCtrl,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: '6-Digit OTP Code',
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
                          final email = emailCtrl.text.trim();
                          if (email.isEmpty || !email.contains('@')) {
                            setDialogState(() => errorMsg = 'Please enter a valid email address');
                            return;
                          }
                          setDialogState(() {
                            loading = true;
                            errorMsg = null;
                            successMsg = null;
                          });

                          final res = await ref.read(authProvider.notifier).requestPasswordReset(email);
                          setDialogState(() {
                            loading = false;
                            if (res['success'] == true) {
                              step = 2;
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
                      : const Text('Send 5-Min Code'),
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
                                emailCtrl.text.trim(),
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
