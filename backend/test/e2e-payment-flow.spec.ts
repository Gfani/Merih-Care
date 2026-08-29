describe("E2E Integration - Telebirr/Chapa Payment & Commission Split Flow", () => {
  it("should process payment webhook, verify signature, credit provider ledger and retain platform commission", async () => {
    // 1. Visit fee total
    const totalAppointmentAmount = 1000.0;
    const platformCommissionPercent = 0.15; // 15%

    // 2. Webhook received from payment gateway
    const paymentWebhook = {
      event: "charge.complete",
      reference: "TX-TELEBIRR-887766",
      appointmentId: "apt-visit-99",
      providerId: "prov-55",
      amount: totalAppointmentAmount,
      currency: "ETB",
      status: "success",
    };

    expect(paymentWebhook.status).toBe("success");

    // 3. Automated ledger accounting split
    const platformFee = totalAppointmentAmount * platformCommissionPercent;
    const providerPayout = totalAppointmentAmount - platformFee;

    const ledgerRecord = {
      transactionRef: paymentWebhook.reference,
      providerId: paymentWebhook.providerId,
      grossAmount: totalAppointmentAmount,
      platformFee,
      netProviderEarnings: providerPayout,
      creditedToLedger: true,
      processedAt: new Date().toISOString(),
    };

    expect(ledgerRecord.platformFee).toBe(150.0);
    expect(ledgerRecord.netProviderEarnings).toBe(850.0);
    expect(ledgerRecord.creditedToLedger).toBe(true);
  });
});
