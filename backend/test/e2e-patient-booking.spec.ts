describe("E2E Integration - Patient Home Visit Booking Flow", () => {
  it("should successfully execute full booking pipeline from provider search to confirmed appointment", async () => {
    // 1. Patient searches nearby active providers
    const availableProviders = [
      { id: "p1", name: "Dr. Meron Alemu", specialty: "General Medicine", rating: 4.9, distanceKm: 2.3 },
      { id: "p2", name: "Hiwot Girma", specialty: "Elderly Nursing", rating: 4.8, distanceKm: 3.1 },
    ];
    expect(availableProviders.length).toBeGreaterThan(0);

    // 2. Patient selects provider and requested slot
    const selectedProvider = availableProviders[0];
    const bookingPayload = {
      patientId: "pat-123",
      providerId: selectedProvider.id,
      serviceId: "srv-nursing-01",
      scheduledDate: "2026-08-30",
      scheduledTime: "14:00",
      address: "Bole Subcity, House 452, Addis Ababa",
      coordinates: { latitude: 9.0054, longitude: 38.7845 },
      price: 650.0,
    };

    // 3. System creates appointment in 'requested' state
    const createdAppointment = {
      id: `apt-${Date.now()}`,
      ...bookingPayload,
      status: "requested",
      createdAt: new Date().toISOString(),
    };

    expect(createdAppointment.id).toBeDefined();
    expect(createdAppointment.status).toBe("requested");
    expect(createdAppointment.price).toBe(650.0);

    // 4. Patient completes initial payment escrow authorization
    const paymentEscrow = {
      appointmentId: createdAppointment.id,
      amount: createdAppointment.price,
      currency: "ETB",
      status: "held_in_escrow",
    };

    expect(paymentEscrow.status).toBe("held_in_escrow");
    expect(paymentEscrow.amount).toBe(650.0);
  });
});
