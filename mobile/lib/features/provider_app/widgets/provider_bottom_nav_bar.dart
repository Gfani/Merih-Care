import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ProviderBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final int pendingRequestsCount;

  const ProviderBottomNavBar({
    super.key,
    required this.currentIndex,
    this.pendingRequestsCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: NavigationBar(
          selectedIndex: currentIndex.clamp(0, 4),
          onDestinationSelected: (index) {
            if (index == currentIndex) return;
            switch (index) {
              case 0:
                context.go('/provider-dashboard');
                break;
              case 1:
                context.go('/provider/requests');
                break;
              case 2:
                context.go('/provider/availability');
                break;
              case 3:
                context.go('/provider/earnings');
                break;
              case 4:
                context.go('/provider/profile');
                break;
            }
          },
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          elevation: 0,
          indicatorColor: const Color(0xFFE6F5F2),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home, color: Color(0xFF0D7C6A)),
              label: 'Home',
            ),
            NavigationDestination(
              icon: pendingRequestsCount > 0
                  ? Badge(
                      label: Text('$pendingRequestsCount'),
                      backgroundColor: const Color(0xFFDC2626),
                      child: const Icon(Icons.assignment_outlined),
                    )
                  : const Icon(Icons.assignment_outlined),
              selectedIcon: pendingRequestsCount > 0
                  ? Badge(
                      label: Text('$pendingRequestsCount'),
                      backgroundColor: const Color(0xFFDC2626),
                      child: const Icon(Icons.assignment, color: Color(0xFF0D7C6A)),
                    )
                  : const Icon(Icons.assignment, color: Color(0xFF0D7C6A)),
              label: 'Requests',
            ),
            const NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined),
              selectedIcon: Icon(Icons.calendar_month, color: Color(0xFF0D7C6A)),
              label: 'Schedule',
            ),
            const NavigationDestination(
              icon: Icon(Icons.account_balance_wallet_outlined),
              selectedIcon: Icon(Icons.account_balance_wallet, color: Color(0xFF0D7C6A)),
              label: 'Earnings',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person, color: Color(0xFF0D7C6A)),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
