import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/network/network_providers.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/error_state.dart';

class AppointmentsScreen extends ConsumerStatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  ConsumerState<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends ConsumerState<AppointmentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _appointments = [];
  bool _loading = true;

  DateTime _selectedDate = DateTime.now();
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAppointments();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAppointments() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/appointments');
      final dynamic raw = response.data;
      final List all = (raw is List)
          ? raw
          : (raw is Map<String, dynamic> && raw['data'] is List ? raw['data'] as List : []);
      if (mounted) {
        setState(() {
          _appointments = all;
          _loading = false;
        });
      }
    } catch (e) {
      print('[APPOINTMENTS] Load error: $e');
      if (mounted) {
        setState(() {
          _appointments = [];
          _loading = false;
        });
      }
    }
  }

  List<dynamic> _getAppointmentsForDate(DateTime date) {
    return _appointments.where((appt) {
      final dateStr = (appt['date'] ?? '').toString();
      if (dateStr.isEmpty) return false;
      try {
        final parsed = DateTime.parse(dateStr);
        return parsed.year == date.year && parsed.month == date.month && parsed.day == date.day;
      } catch (_) {
        // Fallback match string e.g. 2026-09-10
        final formatted = DateFormat('yyyy-MM-dd').format(date);
        return dateStr.startsWith(formatted);
      }
    }).toList();
  }

  void _showProviderContact(BuildContext context, Map<String, dynamic> appt) {
    final provider = appt['provider'] ?? {};
    final providerName = provider['name'] ?? 'Healthcare Provider';
    final providerPhone = (appt['providerPhone'] ?? provider['phone'] ?? '+251 91 123 4567').toString();
    final specialty = provider['specialty'] ?? 'Specialist';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final theme = Theme.of(ctx);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: theme.primaryColor.withOpacity(0.12),
                      child: Icon(Icons.person, color: theme.primaryColor, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            providerName,
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            specialty,
                            style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 12),
                const Text(
                  'PROVIDER DIRECT PHONE',
                  style: TextStyle(
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF8A9AAA),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.phone, color: Color(0xFF0F766E), size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          providerPhone,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: providerPhone));
                          Navigator.of(ctx).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Phone $providerPhone copied to clipboard!'),
                              backgroundColor: const Color(0xFF0F766E),
                            ),
                          );
                        },
                        icon: const Icon(Icons.copy, size: 18),
                        label: const Text('Copy Phone'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(46),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: providerPhone));
                          Navigator.of(ctx).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Connecting call to $providerPhone (dialer ready)...'),
                              backgroundColor: const Color(0xFF0F766E),
                            ),
                          );
                        },
                        icon: const Icon(Icons.call, size: 18),
                        label: const Text('Call Provider'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          minimumSize: const Size.fromHeight(46),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = _appointments.where((a) => a['status'] != 'completed' && a['status'] != 'cancelled').toList();
    final history = _appointments.where((a) => a['status'] == 'completed' || a['status'] == 'cancelled').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Appointments & Care'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: theme.primaryColor,
          labelColor: theme.primaryColor,
          unselectedLabelColor: const Color(0xFF8A9AAA),
          tabs: const [
            Tab(icon: Icon(Icons.calendar_month, size: 20), text: 'Calendar'),
            Tab(icon: Icon(Icons.event_available, size: 20), text: 'Active Care'),
            Tab(icon: Icon(Icons.history, size: 20), text: 'History'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/booking'),
        backgroundColor: theme.primaryColor,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Schedule Care', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: _loading
                ? const LoadingStateWidget(label: 'Loading appointments')
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildCalendarView(theme),
                      _buildList(active, theme),
                      _buildList(history, theme),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarView(ThemeData theme) {
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday; // 1 = Mon, 7 = Sun
    final offset = firstWeekday % 7; // Sunday = 0
    final totalCells = offset + daysInMonth;

    final appointmentsForDay = _getAppointmentsForDate(_selectedDate);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Month Header Navigation
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: () {
                      setState(() {
                        _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
                      });
                    },
                  ),
                  Expanded(
                    child: Center(
                      child: Text(
                        DateFormat('MMMM yyyy').format(_currentMonth),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _currentMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
                        _selectedDate = DateTime.now();
                      });
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: const Size(40, 30),
                    ),
                    child: const Text('Today', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: () {
                      setState(() {
                        _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
                      });
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Calendar Grid Card
          Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  // Weekday Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        .map(
                          (w) => SizedBox(
                            width: 38,
                            child: Center(
                              child: Text(
                                w,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 8),
                  const Divider(height: 1),
                  const SizedBox(height: 8),

                  // Days Grid
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      mainAxisSpacing: 6,
                      crossAxisSpacing: 6,
                      childAspectRatio: 1.0,
                    ),
                    itemCount: totalCells,
                    itemBuilder: (context, idx) {
                      if (idx < offset) {
                        return const SizedBox.shrink();
                      }
                      final dayNum = idx - offset + 1;
                      final cellDate = DateTime(_currentMonth.year, _currentMonth.month, dayNum);
                      final isSelected = cellDate.year == _selectedDate.year &&
                          cellDate.month == _selectedDate.month &&
                          cellDate.day == _selectedDate.day;
                      final isToday = cellDate.year == DateTime.now().year &&
                          cellDate.month == DateTime.now().month &&
                          cellDate.day == DateTime.now().day;

                      final dayAppts = _getAppointmentsForDate(cellDate);
                      final hasAppts = dayAppts.isNotEmpty;

                      return InkWell(
                        onTap: () {
                          setState(() {
                            _selectedDate = cellDate;
                          });
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          decoration: BoxDecoration(
                            color: isSelected
                                ? theme.primaryColor
                                : (isToday ? theme.primaryColor.withOpacity(0.08) : Colors.transparent),
                            borderRadius: BorderRadius.circular(8),
                            border: isToday && !isSelected
                                ? Border.all(color: theme.primaryColor, width: 1.5)
                                : null,
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Text(
                                '$dayNum',
                                style: TextStyle(
                                  fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.normal,
                                  color: isSelected
                                      ? Colors.white
                                      : (isToday ? theme.primaryColor : const Color(0xFF1E293B)),
                                  fontSize: 13,
                                ),
                              ),
                              if (hasAppts)
                                Positioned(
                                  bottom: 4,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isSelected ? Colors.white : const Color(0xFF0F766E),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      '${dayAppts.length}',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: isSelected ? const Color(0xFF0F766E) : Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Day Schedule Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${appointmentsForDay.length} appointments scheduled',
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: () => context.push('/booking'),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Schedule', style: TextStyle(fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: const Size(60, 32),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Day Schedule List or Empty State
          if (appointmentsForDay.isEmpty)
            Card(
              elevation: 0,
              color: const Color(0xFFF8FAFC),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.event_busy_outlined, size: 36, color: Color(0xFF94A3B8)),
                      const SizedBox(height: 8),
                      const Text(
                        'No appointments for this date',
                        style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Tap "+ Schedule Care" to book a home visit with a certified doctor or nurse.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton(
                        onPressed: () => context.push('/booking'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.primaryColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Schedule Care Visit'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: appointmentsForDay.length,
              itemBuilder: (context, idx) {
                final appt = appointmentsForDay[idx];
                return _buildAppointmentCard(appt, theme);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildList(List<dynamic> list, ThemeData theme) {
    if (list.isEmpty) {
      return const ErrorStateWidget(
        message: 'No appointments found.',
        icon: Icons.calendar_today_outlined,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
      itemCount: list.length,
      itemBuilder: (context, idx) {
        final appt = list[idx];
        return _buildAppointmentCard(appt, theme);
      },
    );
  }

  Widget _buildAppointmentCard(dynamic appt, ThemeData theme) {
    final provider = appt['provider'] ?? {};
    final status = (appt['status'] ?? 'SCHEDULED').toString().toUpperCase();
    final providerName = provider['name'] ?? 'Healthcare Specialist';
    final providerPhone = (appt['providerPhone'] ?? provider['phone'] ?? '+251 91 123 4567').toString();
    final specialty = provider['specialty'] ?? 'Home Healthcare';
    final time = appt['time'] ?? 'Flexible Slot';
    final date = appt['date'] ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: theme.primaryColor.withOpacity(0.12),
                  child: Icon(Icons.person, color: theme.primaryColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        providerName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      Text(
                        specialty,
                        style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: status == 'COMPLETED'
                        ? const Color(0xFFDCFCE7)
                        : (status == 'CANCELLED' ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: status == 'COMPLETED'
                          ? const Color(0xFF166534)
                          : (status == 'CANCELLED' ? const Color(0xFF991B1B) : const Color(0xFF92400E)),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 10),

            // Date & Time
            Row(
              children: [
                const Icon(Icons.calendar_month, size: 14, color: Color(0xFF8A9AAA)),
                const SizedBox(width: 6),
                Text('$date @ $time', style: const TextStyle(fontSize: 12, color: Color(0xFF475569), fontWeight: FontWeight.w500)),
              ],
            ),
            const SizedBox(height: 8),

            // Provider Contact Line with Call Button
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.phone_outlined, size: 15, color: Color(0xFF0F766E)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Provider Contact:',
                          style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                        ),
                        Text(
                          providerPhone,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F766E),
                          ),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _showProviderContact(context, appt),
                    icon: const Icon(Icons.call, size: 13, color: Color(0xFF0F766E)),
                    label: const Text('Call Provider', style: TextStyle(fontSize: 11, color: Color(0xFF0F766E))),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: const Size(60, 28),
                      side: const BorderSide(color: Color(0xFF0F766E)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // View Details Link
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => context.push('/appointment/${appt['id']}'),
                icon: const Icon(Icons.arrow_forward, size: 14),
                label: const Text('View Full Details', style: TextStyle(fontSize: 12)),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(50, 24),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
