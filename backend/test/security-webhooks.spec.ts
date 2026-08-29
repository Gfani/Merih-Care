import * as crypto from "crypto";

describe("Security - Webhook Forgery & HMAC Signature Tests", () => {
  const webhookSecret = "whsec_merihcare_production_secret_key_889900";

  const generateSignature = (payload: string, secret = webhookSecret): string => {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  };

  const verifyWebhookSignature = (payload: string, signature: string, secret = webhookSecret): boolean => {
    try {
      const expected = generateSignature(payload, secret);
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  };

  it("should verify valid webhook signature generated with shared secret", () => {
    const payload = JSON.stringify({
      id: "evt_12345",
      type: "payment.succeeded",
      data: { appointmentId: "apt-101", amount: 1500 },
    });

    const signature = generateSignature(payload);
    const isValid = verifyWebhookSignature(payload, signature);

    expect(isValid).toBe(true);
  });

  it("should reject forged webhook signature created with wrong secret", () => {
    const payload = JSON.stringify({
      id: "evt_fake",
      type: "payment.succeeded",
      data: { appointmentId: "apt-fake", amount: 50000 },
    });

    const forgedSignature = generateSignature(payload, "attacker-fake-secret");
    const isValid = verifyWebhookSignature(payload, forgedSignature);

    expect(isValid).toBe(false);
  });

  it("should reject tampered payload even if initial signature was valid", () => {
    const originalPayload = JSON.stringify({
      id: "evt_12345",
      type: "payment.succeeded",
      data: { appointmentId: "apt-101", amount: 1500 },
    });

    const signature = generateSignature(originalPayload);

    // Attacker modifies the payload amount
    const tamperedPayload = JSON.stringify({
      id: "evt_12345",
      type: "payment.succeeded",
      data: { appointmentId: "apt-101", amount: 999999 },
    });

    const isValid = verifyWebhookSignature(tamperedPayload, signature);
    expect(isValid).toBe(false);
  });
});
