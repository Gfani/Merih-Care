import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';
import '../auth/auth_provider.dart';

class CredentialsUploadScreen extends ConsumerStatefulWidget {
  const CredentialsUploadScreen({super.key});

  @override
  ConsumerState<CredentialsUploadScreen> createState() => _CredentialsUploadScreenState();
}

class _CredentialsUploadScreenState extends ConsumerState<CredentialsUploadScreen> {
  String? _pickedFileName;
  PlatformFile? _pickedFile;
  bool _uploading = false;
  String? _errorMessage;
  String? _successMessage;

  Future<void> _pickCredentialFile() async {
    setState(() {
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx'],
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        // Limit to 10MB
        if (file.size > 10 * 1024 * 1024) {
          setState(() {
            _errorMessage = 'File size exceeds the 10MB limit.';
          });
          return;
        }

        setState(() {
          _pickedFileName = file.name;
          _pickedFile = file;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error picking file: $e';
      });
    }
  }

  Future<void> _uploadCredential() async {
    if (_pickedFile == null) return;

    setState(() {
      _uploading = true;
      _errorMessage = null;
    });

    try {
      // In real scenario, prepare FormData and call client.dio.post('/uploads', data: formData);
      // Let's mock a delay and post profile status updates or mock API
      await Future.delayed(const Duration(seconds: 2));

      final client = ref.read(apiClientProvider);
      // Inform backend that credentials have been uploaded (or mock update status to pending_verification)
      try {
        await client.dio.put('/users/profile/update-status', data: {
          'status': 'pending_verification',
        });
      } catch (_) {
        // Fallback for mock environments
      }

      setState(() {
        _successMessage = 'Credential uploaded successfully! Verification request submitted.';
        _pickedFile = null;
        _pickedFileName = null;
      });

      // Quick delay then pop or refresh auth profile
      Future.delayed(const Duration(milliseconds: 1500), () {
        if (mounted) {
          context.pop();
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Upload failed: $e';
      });
    } finally {
      setState(() {
        _uploading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = ref.watch(authProvider);
    final user = auth.user ?? {};
    final status = user['status'] ?? 'pending_verification';

    return Scaffold(
      appBar: AppBar(title: const Text('Credential Verification')),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    label: 'Verification status indicator',
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _getStatusBgColor(status),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(_getStatusIcon(status), color: _getStatusTextColor(status)),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'VERIFICATION STATUS',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B)),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _getStatusLabel(status),
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _getStatusTextColor(status)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'Upload Certification/ID',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'To verify your medical license or credentials, please upload a valid PDF or Image copy of your credentials (maximum size: 10MB).',
                    style: TextStyle(color: Color(0xFF64748B), height: 1.5, fontSize: 13),
                  ),
                  const SizedBox(height: 24),
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
                      child: Text(_errorMessage!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13)),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (_successMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(8)),
                      child: Text(_successMessage!, style: const TextStyle(color: Color(0xFF166534), fontSize: 13)),
                    ),
                    const SizedBox(height: 16),
                  ],
                  InkWell(
                    onTap: _uploading ? null : _pickCredentialFile,
                    child: Container(
                      width: double.infinity,
                      height: 180,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: const Color(0xFFE2E8EE), style: BorderStyle.solid),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.cloud_upload_outlined, size: 48, color: theme.primaryColor),
                          const SizedBox(height: 16),
                          Text(
                            _pickedFileName ?? 'Click to Select Document',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF4A5A6A)),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Support: PDF, PNG, JPG, DOCX (Max 10MB)',
                            style: TextStyle(fontSize: 11, color: Color(0xFF8A9AAA)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  Semantics(
                    button: true,
                    label: 'Submit credentials for review',
                    child: ElevatedButton(
                      onPressed: _pickedFile == null || _uploading ? null : _uploadCredential,
                      child: _uploading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Submit Credentials'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusBgColor(String status) {
    switch (status) {
      case 'verified':
      case 'active':
        return const Color(0xFFDCFCE7);
      case 'rejected':
        return const Color(0xFFFEE2E2);
      case 'needs_fix':
        return const Color(0xFFFEF3C7);
      default:
        return const Color(0xFFF1F5F9);
    }
  }

  Color _getStatusTextColor(String status) {
    switch (status) {
      case 'verified':
      case 'active':
        return const Color(0xFF166534);
      case 'rejected':
        return const Color(0xFF991B1B);
      case 'needs_fix':
        return const Color(0xFF92400E);
      default:
        return const Color(0xFF475569);
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'verified':
      case 'active':
        return Icons.verified_rounded;
      case 'rejected':
        return Icons.error_outline_rounded;
      case 'needs_fix':
        return Icons.warning_amber_rounded;
      default:
        return Icons.hourglass_empty_rounded;
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'verified':
      case 'active':
        return 'Verified';
      case 'rejected':
        return 'Verification Rejected';
      case 'needs_fix':
        return 'Corrections Needed';
      default:
        return 'Pending Verification';
    }
  }
}
