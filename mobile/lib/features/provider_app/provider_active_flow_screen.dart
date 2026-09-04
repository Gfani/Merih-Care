import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/create_design_widgets.dart';

enum ProviderFlowStep {
  incoming,
  accepted,
  navigating,
  arrived,
  inProgress,
  completed,
}

class ProviderActiveFlowScreen extends ConsumerStatefulWidget {
  const ProviderActiveFlowScreen({super.key});

  @override
  ConsumerState<ProviderActiveFlowScreen> createState() => _ProviderActiveFlowScreenState();
}

class _ProviderActiveFlowScreenState extends ConsumerState<ProviderActiveFlowScreen> {
  ProviderFlowStep _currentStep = ProviderFlowStep.incoming;
  int _countdownSeconds = 30;
  Timer? _countdownTimer;

  int _visitSeconds = 0;
  Timer? _visitTimer;

  // Clinical Vitals Form Controllers
  final TextEditingController _bpController = TextEditingController(text: '120/80');
  final TextEditingController _pulseController = TextEditingController(text: '72');
  final TextEditingController _tempController = TextEditingController(text: '36.6');
  final TextEditingController _clinicalNotesController = TextEditingController(text: 'Patient presented for routine checkup. Vitals stable, dressing changed cleanly.');
  final TextEditingController _prescriptionsController = TextEditingController(text: 'Amoxicillin 500mg PO TID x 5 days');

  final Map<String, dynamic> _requestData = {
    'id': 'req-901',
    'patientName': 'Tigist Bekele',
    'patientPhone': '+251 91 234 5678',
    'service': 'Doctor Home Visit',
    'address': 'Bole Subcity, Kebele 03, House 452, Addis Ababa',
    'distanceKm': 2.4,
    'etaMinutes': 12,
    'grossFee': 800.0,
    'commissionRate': 0.15,
  };

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _visitTimer?.cancel();
    _bpController.dispose();
    _pulseController.dispose();
    _tempController.dispose();
    _clinicalNotesController.dispose();
    _prescriptionsController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _countdownSeconds = 30;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 0) {
        setState(() => _countdownSeconds--);
      } else {
        timer.cancel();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request timed out and offered to next provider.')),
        );
        context.go('/provider-dashboard');
      }
    });
  }

  Future<void> _acceptDispatch() async {
    _countdownTimer?.cancel();
    try {
      final client = ref.read(apiClientProvider);
      final aptId = _requestData['id']?.toString() ?? 'apt-1';
      await client.dio.put('/appointments/$aptId/status', data: {
        'status': 'accepted',
      });
    } catch (e) {
      print('[PROVIDER] Accept dispatch error: $e');
    }
    setState(() => _currentStep = ProviderFlowStep.accepted);
  }

  void _startVisit() {
    setState(() {
      _currentStep = ProviderFlowStep.inProgress;
      _visitSeconds = 0;
    });

    _visitTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _visitSeconds++);
    });
  }

  String _formatTimer(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surfaceColor,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => context.go('/provider-dashboard'),
        ),
        title: Text(_getTitle()),
      ),
      body: SafeArea(
        child: _buildBody(),
      ),
    );
  }

  String _getTitle() {
    switch (_currentStep) {
      case ProviderFlowStep.incoming: return 'Incoming Dispatch Alert';
      case ProviderFlowStep.accepted: return 'Dispatch Accepted';
      case ProviderFlowStep.navigating: return 'Turn-by-Turn Navigation';
      case ProviderFlowStep.arrived: return 'Arrived at Patient Home';
      case ProviderFlowStep.inProgress: return 'Clinical Visit in Progress';
      case ProviderFlowStep.completed: return 'Visit Summary & Earnings';
    }
  }

  Widget _buildBody() {
    switch (_currentStep) {
      case ProviderFlowStep.incoming:
        return _buildIncomingScreen();
      case ProviderFlowStep.accepted:
        return _buildAcceptedScreen();
      case ProviderFlowStep.navigating:
        return _buildNavigatingScreen();
      case ProviderFlowStep.arrived:
        return _buildArrivedScreen();
      case ProviderFlowStep.inProgress:
        return _buildInProgressScreen();
      case ProviderFlowStep.completed:
        return _buildCompletedScreen();
    }
  }

  // ─── 1. INCOMING REQUEST WITH COUNTDOWN ───────────────────────────────────────
  Widget _buildIncomingScreen() {
    final progress = _countdownSeconds / 30.0;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 90,
                height: 90,
                child: CircularProgressIndicator(
                  value: progress,
                  strokeWidth: 6,
                  backgroundColor: AppTheme.borderColor,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _countdownSeconds <= 10 ? AppTheme.errorColor : AppTheme.primaryColor,
                  ),
                ),
              ),
              Text(
                '$_countdownSeconds s',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: _countdownSeconds <= 10 ? AppTheme.errorColor : AppTheme.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text('New Home Visit Request!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('A patient is requesting immediate on-demand care.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 20),
          CardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AvatarWidget(name: _requestData['patientName'], radius: 22),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_requestData['patientName'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          Text(_requestData['service'], style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        ],
                      ),
                    ),
                    Text(
                      'ETB ${_requestData['grossFee'].toInt()}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor),
                    ),
                  ],
                ),
                const Divider(height: 24, color: AppTheme.borderColor),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.primaryColor),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _requestData['address'],
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.route_outlined, size: 16, color: AppTheme.secondaryColor),
                    const SizedBox(width: 6),
                    Text(
                      '${_requestData['distanceKm']} km away  ·  ~${_requestData['etaMinutes']} min drive',
                      style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    _countdownTimer?.cancel();
                    context.go('/provider-dashboard');
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.errorColor),
                    foregroundColor: AppTheme.errorColor,
                  ),
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _acceptDispatch,
                  child: const Text('Accept Visit'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── 2. ACCEPTED SCREEN ──────────────────────────────────────────────────────
  Widget _buildAcceptedScreen() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: AppTheme.successLight, shape: BoxShape.circle),
            child: const Icon(Icons.check_circle_outline, color: AppTheme.successColor, size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Visit Request Accepted!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Patient has been notified that you are en route.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 24),
          CardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AvatarWidget(name: _requestData['patientName'], radius: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_requestData['patientName'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          Text(_requestData['patientPhone'], style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.phone, color: AppTheme.primaryColor),
                      onPressed: () {},
                    ),
                  ],
                ),
                const Divider(height: 20, color: AppTheme.borderColor),
                Text('Destination: ${_requestData['address']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => setState(() => _currentStep = ProviderFlowStep.navigating),
            icon: const Icon(Icons.navigation_outlined, size: 18),
            label: const Text('Start Turn-by-Turn GPS Navigation'),
          ),
        ],
      ),
    );
  }

  // ─── 3. NAVIGATING SCREEN ────────────────────────────────────────────────────
  Widget _buildNavigatingScreen() {
    return Column(
      children: [
        Expanded(
          child: Container(
            color: const Color(0xFFE2E8EE),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.directions_car, size: 48, color: AppTheme.primaryColor),
                      SizedBox(height: 6),
                      Text('Route: 2.4 km via Bole Rd', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textSecondary)),
                      Text('Estimated Arrival: 12 mins', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                    ],
                  ),
                ),
                Positioned(
                  top: 16,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.turn_right, size: 28, color: AppTheme.primaryColor),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('In 400m, turn right onto Africa Avenue', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              Text('Destination on right: ${_requestData['address']}', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.white,
          child: ElevatedButton(
            onPressed: () => setState(() => _currentStep = ProviderFlowStep.arrived),
            child: const Text('I Have Arrived at Patient Location'),
          ),
        ),
      ],
    );
  }

  // ─── 4. ARRIVED SCREEN ───────────────────────────────────────────────────────
  Widget _buildArrivedScreen() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: Color(0xFFEDE9FE), shape: BoxShape.circle),
            child: const Icon(Icons.pin_drop, color: Color(0xFF7C3AED), size: 48),
          ),
          const SizedBox(height: 16),
          const Text('You Have Arrived at Location', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Verify patient identity and commence medical treatment.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 24),
          CardWidget(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    AvatarWidget(name: _requestData['patientName'], radius: 20),
                    const SizedBox(width: 12),
                    Text(_requestData['patientName'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                const Divider(height: 20, color: AppTheme.borderColor),
                const Text('Enter 4-Digit Patient Security Code', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                const SizedBox(height: 8),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('8492', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 4, color: AppTheme.primaryColor)),
                    SizedBox(width: 8),
                    Icon(Icons.check_circle, color: AppTheme.successColor, size: 20),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _startVisit,
            child: const Text('Commence Treatment / Start Visit'),
          ),
        ],
      ),
    );
  }

  // ─── 5. IN PROGRESS SCREEN (CLINICAL VITALS SHEET) ───────────────────────────
  Widget _buildInProgressScreen() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardWidget(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Visit Duration', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                    const SizedBox(height: 2),
                    Text(_formatTimer(_visitSeconds), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                  ],
                ),
                const StatusBadgeWidget(status: 'in_progress'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Record Clinical Vitals & Notes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _bpController,
                  decoration: const InputDecoration(labelText: 'BP (mmHg)', hintText: '120/80'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _pulseController,
                  decoration: const InputDecoration(labelText: 'Pulse (bpm)', hintText: '72'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _tempController,
                  decoration: const InputDecoration(labelText: 'Temp (°C)', hintText: '36.6'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _clinicalNotesController,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Clinical Examination & Assessment', alignLabelWithHint: true),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _prescriptionsController,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Prescriptions & Care Instructions', alignLabelWithHint: true),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              _visitTimer?.cancel();
              setState(() => _currentStep = ProviderFlowStep.completed);
            },
            child: const Text('Finish Visit & Process Settlement'),
          ),
        ],
      ),
    );
  }

  // ─── 6. COMPLETED SCREEN & EARNINGS SPLIT ─────────────────────────────────────
  Widget _buildCompletedScreen() {
    final gross = _requestData['grossFee'] as double;
    final commission = gross * (_requestData['commissionRate'] as double); // 15%
    final netPayout = gross - commission; // 85%

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: AppTheme.successLight, shape: BoxShape.circle),
            child: const Icon(Icons.check_circle_outline, color: AppTheme.successColor, size: 48),
          ),
          const SizedBox(height: 16),
          const Text('Visit Successfully Completed!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Medical records synced and earnings added to ledger.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          const SizedBox(height: 20),
          CardWidget(
            child: Column(
              children: [
                const Text('Settlement Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const Divider(height: 20, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Gross Consultation Fee', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('ETB ${gross.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Platform Commission (15%)', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    Text('- ETB ${commission.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.errorColor, fontSize: 13)),
                  ],
                ),
                const Divider(height: 20, color: AppTheme.borderColor),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Net Provider Payout (85%)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    Text('ETB ${netPayout.toInt()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => context.go('/provider-dashboard'),
            child: const Text('Return to Provider Dashboard'),
          ),
        ],
      ),
    );
  }
}
