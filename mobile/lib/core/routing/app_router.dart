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
import '../../features/patient/medical_information_screen.dart';
import '../../features/payments/payout_methods_screen.dart';

// Provider App imports
import '../../features/provider_app/provider_dashboard_screen.dart';
import '../../features/provider_app/provider_verification_screen.dart';
import '../../features/provider_app/provider_requests_screen.dart';
import '../../features/provider_app/credentials_upload_screen.dart';
import '../../features/provider_app/provider_availability_screen.dart';
import '../../features/provider_app/provider_appointment_details_screen.dart';
import '../../features/provider_app/provider_map_navigation_screen.dart';
import '../../features/provider_app/provider_earnings_screen.dart';
import '../../features/provider_app/provider_active_flow_screen.dart';
import '../../features/provider_app/provider_edit_profile_screen.dart';
import '../../features/provider_app/provider_profile_settings_screen.dart';
import '../../features/splash/splash_screen.dart';

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
    initialLocation: '/',
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final isAuth = auth.status == AuthStatus.authenticated;
      final location = state.uri.path;
      final isAuthPage = location == '/login' || location == '/signup';
      final isOnboarding = location == '/onboarding';
      final isSplash = location == '/';

      if (auth.status == AuthStatus.unknown) {
        return isSplash ? null : '/';
      }

      if (isAuth) {
        final user = auth.user;
        final bool isProviderAccount = user != null &&
            (user['role'] == 'provider' ||
                user['hasProviderAccount'] == true ||
                (user['roles'] is List && (user['roles'] as List).contains('provider')) ||
                (user['roles'] is String && (user['roles'] as String).contains('provider')) ||
                user['provider'] != null ||
                user['providerId'] != null);

        if (isAuthPage || isOnboarding || isSplash) {
          final target = (isProviderAccount && user['role'] == 'provider') ? '/provider-dashboard' : '/dashboard';
          return target;
        }

        // Pure patients must NEVER be able to access provider mode routes
        if (!isProviderAccount &&
            (location == '/provider-dashboard' || location.startsWith('/provider/'))) {
          return '/dashboard';
        }

        return null;
      } else {
        if (isSplash) {
          return '/onboarding';
        }
        if (!isAuthPage && !isOnboarding) {
          return '/login';
        }
        return null;
      }
    },
    routes: [
      GoRoute(path: '/', builder: (ctx, _) => const SplashScreen()),
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
        builder: (ctx, state) => BookingScreen(
          providerId: state.uri.queryParameters['providerId'] ?? '',
          serviceId: state.uri.queryParameters['serviceId'],
          serviceName: state.uri.queryParameters['service'] ?? state.uri.queryParameters['serviceName'] ?? state.uri.queryParameters['specialty'],
        ),
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
      GoRoute(path: '/profile', builder: (ctx, _) => const ProfileSettingsScreen()),
      GoRoute(path: '/medical-information', builder: (ctx, _) => const MedicalInformationScreen()),
      GoRoute(path: '/payout-methods', builder: (ctx, _) => const PayoutMethodsScreen()),
      GoRoute(
        path: '/patient/on-demand',
        builder: (ctx, state) => OnDemandFlowScreen(
          initialAppointmentId: state.uri.queryParameters['appointmentId'],
        ),
      ),

      // Provider App Routes
      GoRoute(path: '/provider-dashboard', builder: (ctx, _) => const ProviderDashboardScreen()),
      GoRoute(path: '/provider/requests', builder: (ctx, _) => const ProviderRequestsScreen()),
      GoRoute(path: '/provider/verification', builder: (ctx, _) => const ProviderVerificationScreen()),
      GoRoute(path: '/provider/payout-methods', builder: (ctx, _) => const PayoutMethodsScreen()),
      GoRoute(path: '/provider/profile', builder: (ctx, _) => const ProviderProfileSettingsScreen()),
      GoRoute(path: '/provider/edit-profile', builder: (ctx, _) => const ProviderEditProfileScreen()),
      GoRoute(
        path: '/provider/active-request', 
        builder: (ctx, state) => ProviderActiveFlowScreen(
          requestData: state.extra as Map<String, dynamic>?,
          appointmentId: state.uri.queryParameters['appointmentId'],
        ),
      ),
      GoRoute(path: '/provider/credentials', builder: (ctx, _) => const CredentialsUploadScreen()),
      GoRoute(path: '/provider/availability', builder: (ctx, _) => const ProviderAvailabilityScreen()),
      GoRoute(
        path: '/provider/appointment/:id',
        builder: (ctx, state) => ProviderAppointmentDetailsScreen(appointmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/map/:id',
        builder: (ctx, state) {
          final extra = state.extra is Map ? state.extra as Map : null;
          final query = state.uri.queryParameters;

          double? pLat = double.tryParse(query['lat'] ?? query['patientLat'] ?? '');
          double? pLon = double.tryParse(query['lng'] ?? query['lon'] ?? query['patientLon'] ?? query['patientLng'] ?? '');
          String? pName = query['name'] ?? query['patientName'];

          if (extra != null) {
            final rawLat = extra['patientLat'] ?? extra['latitude'] ?? extra['lat'];
            if (rawLat is num) pLat ??= rawLat.toDouble();
            if (rawLat is String) pLat ??= double.tryParse(rawLat);

            final rawLon = extra['patientLng'] ?? extra['longitude'] ?? extra['lng'];
            if (rawLon is num) pLon ??= rawLon.toDouble();
            if (rawLon is String) pLon ??= double.tryParse(rawLon);

            if ((pLat == null || pLon == null) && extra['location'] is Map) {
              final loc = extra['location'] as Map;
              final locLat = loc['latitude'] ?? loc['lat'];
              final locLng = loc['longitude'] ?? loc['lng'];
              if (locLat is num) pLat ??= locLat.toDouble();
              if (locLng is num) pLon ??= locLng.toDouble();
            }

            pName ??= extra['patientName']?.toString() ??
                (extra['patient'] is Map ? extra['patient']['name']?.toString() : null);
          }

          return ProviderMapNavigationScreen(
            appointmentId: state.pathParameters['id']!,
            patientLat: pLat,
            patientLon: pLon,
            patientName: pName,
          );
        },
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
