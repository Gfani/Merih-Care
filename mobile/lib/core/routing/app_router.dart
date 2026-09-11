import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/signup_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/patient/dashboard_screen.dart';
import '../../features/provider/service_catalogue_screen.dart';
import '../../features/provider/provider_search_screen.dart';
import '../../features/provider/provider_profile_screen.dart';
import '../../features/patient/booking_screen.dart';
import '../../features/patient/appointments_screen.dart';
import '../../features/patient/appointment_details_screen.dart';
import '../../features/patient/reschedule_screen.dart';
import '../../features/payments/payment_screen.dart';
import '../../features/payments/receipts_screen.dart';
import '../../features/chat/chat_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/patient/medical_records_screen.dart';
import '../../features/patient/emergency_screen.dart';
import '../../features/patient/profile_settings_screen.dart';
import '../../features/patient/on_demand_flow_screen.dart';

// Provider App imports
import '../../features/provider_app/provider_dashboard_screen.dart';
import '../../features/provider_app/credentials_upload_screen.dart';
import '../../features/provider_app/provider_availability_screen.dart';
import '../../features/provider_app/provider_appointment_details_screen.dart';
import '../../features/provider_app/provider_map_navigation_screen.dart';
import '../../features/provider_app/provider_earnings_screen.dart';
import '../../features/provider_app/provider_active_flow_screen.dart';
import '../../features/provider_app/provider_edit_profile_screen.dart';

class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(
      authProvider,
      (_, __) => notifyListeners(),
    );
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  return RouterNotifier(ref);
});

final appRouter = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    initialLocation: '/onboarding',
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final isAuth = auth.status == AuthStatus.authenticated;
      final location = state.uri.path;
      final isAuthPage = location == '/login' || location == '/signup';
      final isOnboarding = location == '/onboarding';

      print('[ROUTER] redirect: location=$location, isAuth=$isAuth, status=${auth.status}, role=${auth.user?['role']}');

      if (auth.status == AuthStatus.unknown) {
        return null;
      }

      if (!isAuth && !isAuthPage && !isOnboarding) {
        print('[ROUTER] Redirecting to /login (not authenticated)');
        return '/login';
      }
      if (isAuth && (isAuthPage || isOnboarding)) {
        final role = auth.user?['role'];
        final target = role == 'provider' ? '/provider-dashboard' : '/dashboard';
        print('[ROUTER] Redirecting to $target (authenticated, role=$role)');
        return target;
      }
      print('[ROUTER] Allowing navigation to: $location');
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (ctx, _) => const OnboardingScreen()),
      GoRoute(path: '/login', builder: (ctx, _) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (ctx, _) => const SignupScreen()),
      GoRoute(path: '/dashboard', builder: (ctx, _) => const DashboardScreen()),
      GoRoute(path: '/services', builder: (ctx, _) => const ServiceCatalogueScreen()),
      GoRoute(
        path: '/search-provider',
        builder: (ctx, state) {
          final specialty = state.uri.queryParameters['specialty'];
          return ProviderSearchScreen(specialty: specialty);
        },
      ),
      GoRoute(
        path: '/booking',
        builder: (ctx, state) => BookingScreen(providerId: state.uri.queryParameters['providerId'] ?? ''),
      ),
      GoRoute(path: '/appointments', builder: (ctx, _) => const AppointmentsScreen()),
      GoRoute(
        path: '/appointment/:id',
        builder: (ctx, state) => AppointmentDetailsScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/appointment/:id/reschedule',
        builder: (ctx, state) => RescheduleScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/payment',
        builder: (ctx, state) => PaymentScreen(appointmentId: state.uri.queryParameters['appointmentId'] ?? ''),
      ),
      GoRoute(path: '/receipts', builder: (ctx, _) => const ReceiptsScreen()),
      GoRoute(
        path: '/chat/:id',
        builder: (ctx, state) => ChatScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/notifications', builder: (ctx, _) => const NotificationsScreen()),
      GoRoute(path: '/medical-records', builder: (ctx, _) => const MedicalRecordsScreen()),
      GoRoute(path: '/emergency', builder: (ctx, _) => const EmergencyScreen()),
      GoRoute(path: '/profile-settings', builder: (ctx, _) => const ProfileSettingsScreen()),
      GoRoute(path: '/patient/on-demand', builder: (ctx, _) => const OnDemandFlowScreen()),

      // Provider App Routes
      GoRoute(path: '/provider-dashboard', builder: (ctx, _) => const ProviderDashboardScreen()),
      GoRoute(path: '/provider/profile', builder: (ctx, _) => const ProviderEditProfileScreen()),
      GoRoute(
        path: '/provider/active-request', 
        builder: (ctx, state) => ProviderActiveFlowScreen(requestData: state.extra as Map<String, dynamic>?),
      ),
      GoRoute(path: '/provider/credentials', builder: (ctx, _) => const CredentialsUploadScreen()),
      GoRoute(path: '/provider/availability', builder: (ctx, _) => const ProviderAvailabilityScreen()),
      GoRoute(
        path: '/provider/appointment/:id',
        builder: (ctx, state) => ProviderAppointmentDetailsScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/map/:id',
        builder: (ctx, state) => ProviderMapNavigationScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/provider/earnings', builder: (ctx, _) => const ProviderEarningsScreen()),

      // Provider Profile (Patient view & alias)
      GoRoute(
        path: '/providers/:id',
        builder: (ctx, state) => ProviderProfileScreen(providerId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/:id',
        builder: (ctx, state) => ProviderProfileScreen(providerId: state.pathParameters['id']!),
      ),
    ],
  );
});
