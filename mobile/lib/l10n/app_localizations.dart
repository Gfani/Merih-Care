import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_am.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('am'),
    Locale('en')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Merihcare'**
  String get appName;

  /// No description provided for @onboarding_title_1.
  ///
  /// In en, this message translates to:
  /// **'Premium Medical Care'**
  String get onboarding_title_1;

  /// No description provided for @onboarding_subtitle_1.
  ///
  /// In en, this message translates to:
  /// **'Access top-tier verified doctors and nurses directly at your home.'**
  String get onboarding_subtitle_1;

  /// No description provided for @onboarding_title_2.
  ///
  /// In en, this message translates to:
  /// **'Instant Booking'**
  String get onboarding_title_2;

  /// No description provided for @onboarding_subtitle_2.
  ///
  /// In en, this message translates to:
  /// **'Schedule consultations, nursing visits, or physio in seconds.'**
  String get onboarding_subtitle_2;

  /// No description provided for @onboarding_title_3.
  ///
  /// In en, this message translates to:
  /// **'Emergency Escapes'**
  String get onboarding_title_3;

  /// No description provided for @onboarding_subtitle_3.
  ///
  /// In en, this message translates to:
  /// **'A single-tap emergency siren dispatches the nearest medical responder.'**
  String get onboarding_subtitle_3;

  /// No description provided for @onboarding_skip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get onboarding_skip;

  /// No description provided for @onboarding_next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get onboarding_next;

  /// No description provided for @onboarding_get_started.
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get onboarding_get_started;

  /// No description provided for @login_title.
  ///
  /// In en, this message translates to:
  /// **'Welcome Back'**
  String get login_title;

  /// No description provided for @login_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to access your premium medical care services.'**
  String get login_subtitle;

  /// No description provided for @login_email.
  ///
  /// In en, this message translates to:
  /// **'Email Address'**
  String get login_email;

  /// No description provided for @login_password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get login_password;

  /// No description provided for @login_button.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get login_button;

  /// No description provided for @login_no_account.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get login_no_account;

  /// No description provided for @login_register.
  ///
  /// In en, this message translates to:
  /// **'Register Now'**
  String get login_register;

  /// No description provided for @signup_title.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get signup_title;

  /// No description provided for @signup_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Join Merihcare to start receiving high-quality home care.'**
  String get signup_subtitle;

  /// No description provided for @signup_name.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get signup_name;

  /// No description provided for @signup_phone.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get signup_phone;

  /// No description provided for @signup_button.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get signup_button;

  /// No description provided for @signup_have_account.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get signup_have_account;

  /// No description provided for @signup_signin.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signup_signin;

  /// No description provided for @dashboard_greeting.
  ///
  /// In en, this message translates to:
  /// **'Hello,'**
  String get dashboard_greeting;

  /// No description provided for @dashboard_emergency_title.
  ///
  /// In en, this message translates to:
  /// **'Urgent Care Required?'**
  String get dashboard_emergency_title;

  /// No description provided for @dashboard_emergency_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Initiate emergency siren to dispatch the nearest medical responder.'**
  String get dashboard_emergency_subtitle;

  /// No description provided for @dashboard_emergency_button.
  ///
  /// In en, this message translates to:
  /// **'ACTIVATE EMERGENCY'**
  String get dashboard_emergency_button;

  /// No description provided for @dashboard_services.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get dashboard_services;

  /// No description provided for @dashboard_upcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Visits'**
  String get dashboard_upcoming;

  /// No description provided for @dashboard_no_visits.
  ///
  /// In en, this message translates to:
  /// **'No upcoming visits.'**
  String get dashboard_no_visits;

  /// No description provided for @services_title.
  ///
  /// In en, this message translates to:
  /// **'Service Catalogue'**
  String get services_title;

  /// No description provided for @search_title.
  ///
  /// In en, this message translates to:
  /// **'Search Providers'**
  String get search_title;

  /// No description provided for @search_hint.
  ///
  /// In en, this message translates to:
  /// **'Search by name...'**
  String get search_hint;

  /// No description provided for @search_filter.
  ///
  /// In en, this message translates to:
  /// **'Filter Providers'**
  String get search_filter;

  /// No description provided for @search_min_rating.
  ///
  /// In en, this message translates to:
  /// **'Minimum Rating'**
  String get search_min_rating;

  /// No description provided for @search_apply.
  ///
  /// In en, this message translates to:
  /// **'Apply Filters'**
  String get search_apply;

  /// No description provided for @provider_bio.
  ///
  /// In en, this message translates to:
  /// **'Biography'**
  String get provider_bio;

  /// No description provided for @provider_hourly_rate.
  ///
  /// In en, this message translates to:
  /// **'Hourly Rate'**
  String get provider_hourly_rate;

  /// No description provided for @provider_reviews.
  ///
  /// In en, this message translates to:
  /// **'Patient Reviews'**
  String get provider_reviews;

  /// No description provided for @provider_book.
  ///
  /// In en, this message translates to:
  /// **'Book Appointment'**
  String get provider_book;

  /// No description provided for @booking_title.
  ///
  /// In en, this message translates to:
  /// **'Schedule Care'**
  String get booking_title;

  /// No description provided for @booking_select_date.
  ///
  /// In en, this message translates to:
  /// **'Select Date'**
  String get booking_select_date;

  /// No description provided for @booking_select_time.
  ///
  /// In en, this message translates to:
  /// **'Select Time Slot'**
  String get booking_select_time;

  /// No description provided for @booking_address.
  ///
  /// In en, this message translates to:
  /// **'Care Location Address'**
  String get booking_address;

  /// No description provided for @booking_notes.
  ///
  /// In en, this message translates to:
  /// **'Patient Notes / Health History'**
  String get booking_notes;

  /// No description provided for @booking_proceed.
  ///
  /// In en, this message translates to:
  /// **'Proceed to Payment'**
  String get booking_proceed;

  /// No description provided for @appointments_title.
  ///
  /// In en, this message translates to:
  /// **'Visits & Bookings'**
  String get appointments_title;

  /// No description provided for @appointments_active.
  ///
  /// In en, this message translates to:
  /// **'Active Care'**
  String get appointments_active;

  /// No description provided for @appointments_history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get appointments_history;

  /// No description provided for @appointments_empty.
  ///
  /// In en, this message translates to:
  /// **'No appointments found.'**
  String get appointments_empty;

  /// No description provided for @details_title.
  ///
  /// In en, this message translates to:
  /// **'Booking Details'**
  String get details_title;

  /// No description provided for @details_schedule.
  ///
  /// In en, this message translates to:
  /// **'CARE SCHEDULE'**
  String get details_schedule;

  /// No description provided for @details_notes.
  ///
  /// In en, this message translates to:
  /// **'PATIENT NOTES'**
  String get details_notes;

  /// No description provided for @details_chat.
  ///
  /// In en, this message translates to:
  /// **'Chat with Provider'**
  String get details_chat;

  /// No description provided for @details_cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel Appointment'**
  String get details_cancel;

  /// No description provided for @details_reschedule.
  ///
  /// In en, this message translates to:
  /// **'Reschedule'**
  String get details_reschedule;

  /// No description provided for @reschedule_title.
  ///
  /// In en, this message translates to:
  /// **'Reschedule Appointment'**
  String get reschedule_title;

  /// No description provided for @reschedule_button.
  ///
  /// In en, this message translates to:
  /// **'Confirm Reschedule'**
  String get reschedule_button;

  /// No description provided for @payment_title.
  ///
  /// In en, this message translates to:
  /// **'Checkout Payment'**
  String get payment_title;

  /// No description provided for @payment_card_info.
  ///
  /// In en, this message translates to:
  /// **'Credit Card Information'**
  String get payment_card_info;

  /// No description provided for @payment_card_number.
  ///
  /// In en, this message translates to:
  /// **'Card Number'**
  String get payment_card_number;

  /// No description provided for @payment_expiry.
  ///
  /// In en, this message translates to:
  /// **'Expiry Date'**
  String get payment_expiry;

  /// No description provided for @payment_cvv.
  ///
  /// In en, this message translates to:
  /// **'CVV'**
  String get payment_cvv;

  /// No description provided for @payment_button.
  ///
  /// In en, this message translates to:
  /// **'Complete Payment'**
  String get payment_button;

  /// No description provided for @payment_success.
  ///
  /// In en, this message translates to:
  /// **'Payment Successful'**
  String get payment_success;

  /// No description provided for @payment_go_home.
  ///
  /// In en, this message translates to:
  /// **'Go to Home'**
  String get payment_go_home;

  /// No description provided for @receipts_title.
  ///
  /// In en, this message translates to:
  /// **'Payment Receipts'**
  String get receipts_title;

  /// No description provided for @receipts_empty.
  ///
  /// In en, this message translates to:
  /// **'No receipts yet.'**
  String get receipts_empty;

  /// No description provided for @chat_online.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get chat_online;

  /// No description provided for @chat_placeholder.
  ///
  /// In en, this message translates to:
  /// **'Type your message...'**
  String get chat_placeholder;

  /// No description provided for @notifications_title.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications_title;

  /// No description provided for @notifications_empty.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get notifications_empty;

  /// No description provided for @records_title.
  ///
  /// In en, this message translates to:
  /// **'Medical Records'**
  String get records_title;

  /// No description provided for @records_encrypted.
  ///
  /// In en, this message translates to:
  /// **'ENCRYPTED'**
  String get records_encrypted;

  /// No description provided for @records_no_notes.
  ///
  /// In en, this message translates to:
  /// **'No notes provided.'**
  String get records_no_notes;

  /// No description provided for @emergency_title.
  ///
  /// In en, this message translates to:
  /// **'Emergency Assistance'**
  String get emergency_title;

  /// No description provided for @emergency_status_idle.
  ///
  /// In en, this message translates to:
  /// **'Double-tap or Hold to Trigger Alert'**
  String get emergency_status_idle;

  /// No description provided for @emergency_panic.
  ///
  /// In en, this message translates to:
  /// **'PANIC'**
  String get emergency_panic;

  /// No description provided for @emergency_active.
  ///
  /// In en, this message translates to:
  /// **'ACTIVE'**
  String get emergency_active;

  /// No description provided for @emergency_cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel Request / Stand Down'**
  String get emergency_cancel;

  /// No description provided for @emergency_gps.
  ///
  /// In en, this message translates to:
  /// **'Locking live GPS coordinates...'**
  String get emergency_gps;

  /// No description provided for @emergency_eta.
  ///
  /// In en, this message translates to:
  /// **'RESPONDER ESTIMATED ARRIVAL'**
  String get emergency_eta;

  /// No description provided for @settings_title.
  ///
  /// In en, this message translates to:
  /// **'Account Settings'**
  String get settings_title;

  /// No description provided for @settings_push.
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get settings_push;

  /// No description provided for @settings_push_sub.
  ///
  /// In en, this message translates to:
  /// **'Receive immediate booking/chat alerts'**
  String get settings_push_sub;

  /// No description provided for @settings_offline.
  ///
  /// In en, this message translates to:
  /// **'Offline Mode Cache'**
  String get settings_offline;

  /// No description provided for @settings_offline_sub.
  ///
  /// In en, this message translates to:
  /// **'Preload schedules for offline accessibility'**
  String get settings_offline_sub;

  /// No description provided for @settings_language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settings_language;

  /// No description provided for @settings_password.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get settings_password;

  /// No description provided for @settings_logout.
  ///
  /// In en, this message translates to:
  /// **'Sign Out'**
  String get settings_logout;

  /// No description provided for @offline_banner.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Some features may be unavailable.'**
  String get offline_banner;

  /// No description provided for @error_generic.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong.'**
  String get error_generic;

  /// No description provided for @error_retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get error_retry;

  /// No description provided for @error_no_internet.
  ///
  /// In en, this message translates to:
  /// **'No internet connection.'**
  String get error_no_internet;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['am', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'am':
      return AppLocalizationsAm();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
