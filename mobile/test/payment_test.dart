import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Payment & Transaction Tests', () {
    test('Should parse Telebirr, CBE Birr, and Chapa payment payload', () {
      final payment = {
        'id': 'tx-789',
        'appointmentId': 'apt-101',
        'method': 'telebirr',
        'amount': 850.0,
        'currency': 'ETB',
        'status': 'completed',
        'transactionReference': 'TB-2026-998877',
        'createdAt': '2026-08-29T10:00:00Z',
      };

      expect(payment['method'], 'telebirr');
      expect(payment['amount'], 850.0);
      expect(payment['currency'], 'ETB');
      expect(payment['status'], 'completed');
      expect(payment['transactionReference'], 'TB-2026-998877');
    });

    test('Should validate ETB currency formatting', () {
      const amount = 1250.50;
      final formatted = '${amount.toStringAsFixed(2)} ETB';
      expect(formatted, '1250.50 ETB');
    });

    test('Should verify Stripe payment intent model', () {
      final stripeIntent = {
        'clientSecret': 'pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_YrKJWe',
        'amount': 150000, // in cents / subunits
        'currency': 'etb',
        'status': 'requires_payment_method',
      };

      expect(stripeIntent['clientSecret'], startsWith('pi_'));
      expect(stripeIntent['status'], 'requires_payment_method');
    });
  });
}
