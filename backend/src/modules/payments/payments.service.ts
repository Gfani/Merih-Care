import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { PaymentEventEntity, RefundEntity, CommissionRecordEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class PaymentsService {
  private readonly chapaSecretKey = process.env.CHAPA_SECRET_KEY || "CHAPA_SEC_TEST_KEY";
  private readonly chapaWebhookSecret = process.env.CHAPA_WEBHOOK_SECRET || "CHAPA_WEBHOOK_TEST_SECRET";

  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    @InjectRepository(PaymentEventEntity)
    private readonly eventRepo: Repository<PaymentEventEntity>,
    @InjectRepository(RefundEntity)
    private readonly refundRepo: Repository<RefundEntity>,
    @InjectRepository(CommissionRecordEntity)
    private readonly commissionRepo: Repository<CommissionRecordEntity>,
    @InjectRepository(ProviderEarningsEntity)
    private readonly earningsRepo: Repository<ProviderEarningsEntity>,
    private readonly dataSource: DataSource,
  ) {}

  getCommissionRate(): number {
    const settingsPath = path.join(process.cwd(), "database", "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        return parseFloat(settings.commissionRate) || 15;
      } catch {
        // fallback
      }
    }
    return 15;
  }

  async getTransactions(limit = 50, offset = 0) {
    const events = await this.eventRepo.find({
      order: { createdAt: "DESC" as any },
      take: limit,
      skip: offset,
    });

    const appointments = await this.appointmentRepo.find({
      relations: ["patient", "provider"],
    });
    const aptMap = new Map(appointments.map((a) => [a.id, a]));

    const result = events.map((evt) => {
      let payload: any = {};
      try {
        payload = JSON.parse(evt.payload || "{}");
      } catch {}

      const apt = payload.appointmentId ? aptMap.get(payload.appointmentId) : null;
      const status =
        evt.eventType === "charge_succeeded"
          ? "successful"
          : evt.eventType === "charge_refunded"
          ? "refunded"
          : evt.eventType === "charge_pending"
          ? "pending"
          : "failed";

      return {
        id: evt.paymentId || evt.id,
        patientName: apt?.patientName || (apt?.patient as any)?.name || payload.first_name || "Patient",
        providerName: apt?.providerName || (apt?.provider as any)?.name || "Assigned Provider",
        service: apt?.service || "Healthcare Consultation",
        amount: payload.amount || apt?.amount || 0,
        method:
          payload.method === "telebirr"
            ? "Telebirr"
            : payload.method === "cbe_birr"
            ? "CBE Birr"
            : payload.method === "chapa"
            ? "Chapa"
            : payload.method || "Digital Payment",
        status,
        date: evt.createdAt ? evt.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
      };
    });

    if (result.length === 0) {
      return appointments.map((apt) => ({
        id: `tx-${apt.id}`,
        patientName: apt.patientName || (apt?.patient as any)?.name || "Patient",
        providerName: apt.providerName || (apt?.provider as any)?.name || "Assigned Provider",
        service: apt.service || "Healthcare Visit",
        amount: apt.amount || 800,
        method: "Telebirr",
        status:
          apt.status === "completed" || apt.status === "scheduled"
            ? "successful"
            : apt.status === "cancelled"
            ? "refunded"
            : "pending",
        date: apt.date || new Date().toISOString().split("T")[0],
      }));
    }

    return result;
  }

  // Initialize Payment Session (Chapa checkout session)
  async initializePayment(appointmentId: string, actorId: string): Promise<any> {
    const apt = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!apt) throw new BadRequestException("Appointment not found");

    if (apt.status === "scheduled" || apt.status === "completed") {
      throw new ConflictException("Appointment is already paid");
    }

    const txRef = `tx-${appointmentId}-${crypto.randomUUID()}`;
    const amount = apt.amount || 100;

    // Register PENDING Payment Event
    const event = new PaymentEventEntity();
    event.id = `evt-${crypto.randomUUID()}`;
    event.paymentId = txRef;
    event.eventType = "charge_pending";
    event.payload = JSON.stringify({ appointmentId, amount, actorId });
    event.createdAt = new Date().toISOString();
    await this.eventRepo.save(event);

    // Call Chapa checkout init
    let checkoutUrl = `https://checkout.chapa.co/checkout/web/payment/${txRef}`;

    if (this.chapaSecretKey && !this.chapaSecretKey.startsWith("CHAPA_SEC_TEST")) {
      try {
        const response = await fetch("https://api.chapa.co/v1/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.chapaSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amount.toString(),
            currency: "ETB",
            email: "patient@merihcare.et",
            first_name: apt.patientName || "Patient",
            last_name: "Merihcare",
            tx_ref: txRef,
            callback_url: `https://api.merihcare.et/api/v1/payments/webhook`,
            return_url: `https://merihcare.et/payment-success?ref=${txRef}`,
            customization: {
              title: "Merihcare Healthcare Service",
              description: `Booking reference: ${appointmentId}`,
            },
          }),
        });

        const resData = await response.json();
        if (response.ok && resData.data?.checkout_url) {
          checkoutUrl = resData.data.checkout_url;
        }
      } catch (err) {
        console.warn("Chapa connection failed, using offline simulation checkout url", err);
      }
    }

    return { txRef, checkoutUrl };
  }

  async processDirectPayment(
    appointmentId: string,
    method: string,
    actorId: string,
    accountNumber?: string,
    amountOverride?: number,
  ): Promise<any> {
    const apt = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    const amount = amountOverride || apt?.amount || 800;
    const txRef = `TXN-${crypto.randomUUID()}`;

    const payload = { appointmentId, amount, method, actorId, accountNumber };
    await this.processSuccessfulPayment(txRef, payload);

    return {
      success: true,
      transactionId: txRef,
      status: "successful",
      method: method === "telebirr" ? "Telebirr" : method === "cbe_birr" ? "CBE Birr" : method === "chapa" ? "Chapa" : "Cash",
      amount,
      appointmentId,
      date: new Date().toISOString().split("T")[0],
    };
  }

  // Verify transaction status (Server-to-Server)
  async verifyPayment(txRef: string): Promise<any> {
    let status = "failed";
    let chapaResponse: any = {};

    if (this.chapaSecretKey && !this.chapaSecretKey.startsWith("CHAPA_SEC_TEST")) {
      try {
        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.chapaSecretKey}`,
          },
        });
        chapaResponse = await response.json();
        if (response.ok && chapaResponse.data?.status === "success") {
          status = "success";
        }
      } catch (err) {
        console.warn("Chapa verify call failed, running offline verification simulation");
      }
    } else {
      status = "success";
      chapaResponse = { data: { status: "success", amount: 100 } };
    }

    if (status === "success") {
      await this.processSuccessfulPayment(txRef, chapaResponse);
      return { status: "success", txRef };
    }

    throw new BadRequestException("Payment verification failed");
  }

  // Webhook integration (Verifies Webhook Signatures)
  async handleWebhook(body: any, rawBody: string, chapaSignature: string): Promise<any> {
    const computedSignature = crypto
      .createHmac("sha256", this.chapaWebhookSecret)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== chapaSignature) {
      throw new BadRequestException("Webhook signature verification failed");
    }

    const txRef = body.tx_ref;
    if (!txRef) throw new BadRequestException("Missing tx_ref in webhook body");

    if (body.status === "success" || body.status === "successful") {
      await this.processSuccessfulPayment(txRef, body);
      return { success: true, status: "processed" };
    }

    return { success: true, status: "ignored" };
  }

  // Atomic database ledger crediting & status updates
  async processSuccessfulPayment(txRef: string, payload: any): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const processed = await manager.findOne(PaymentEventEntity, {
        where: { paymentId: txRef, eventType: "charge_succeeded" },
      });
      if (processed) return;

      const event = new PaymentEventEntity();
      event.id = `evt-${crypto.randomUUID()}`;
      event.paymentId = txRef;
      event.eventType = "charge_succeeded";
      event.payload = typeof payload === "string" ? payload : JSON.stringify(payload);
      event.createdAt = new Date().toISOString();
      await manager.save(event);

      // Extract appointment ID
      let aptId = payload?.appointmentId;
      if (!aptId) {
        const parts = txRef.split("-");
        if (parts.length >= 2) {
          aptId = parts.slice(1, parts.length - 1).join("-") || parts[1];
        }
      }

      if (!aptId) return;

      const apt = await manager.findOne(AppointmentEntity, { where: { id: aptId } });
      if (!apt) return;

      apt.status = "scheduled";
      await manager.save(apt);

      const rate = this.getCommissionRate();
      const amount = apt.amount || payload.amount || 0;
      const commissionAmount = amount * (rate / 100);
      const netEarnings = amount - commissionAmount;

      const commRecord = new CommissionRecordEntity();
      commRecord.id = `com-${crypto.randomUUID()}`;
      commRecord.paymentId = txRef;
      commRecord.amount = commissionAmount;
      commRecord.ratePercentage = rate;
      commRecord.status = "processed";
      commRecord.createdAt = new Date().toISOString();
      await manager.save(commRecord);

      if (apt.providerId) {
        let ledger = await manager.findOne(ProviderEarningsEntity, { where: { providerId: apt.providerId } });
        if (!ledger) {
          ledger = new ProviderEarningsEntity();
          ledger.providerId = apt.providerId;
          ledger.balance = 0;
          ledger.totalEarned = 0;
          ledger.totalWithdrawn = 0;
        }
        ledger.balance += netEarnings;
        ledger.totalEarned += netEarnings;
        ledger.updatedAt = new Date().toISOString();
        await manager.save(ledger);
      }
    });
  }

  // Refund Payment
  async refundPayment(id: string, reason: string, actorId: string): Promise<RefundEntity> {
    return this.dataSource.transaction(async (manager) => {
      const apt = await manager.findOne(AppointmentEntity, { where: { id } });
      if (!apt) throw new BadRequestException("Appointment not found");

      const txRefSearch = `tx-${id}-`;
      const event = await manager
        .createQueryBuilder(PaymentEventEntity, "event")
        .where("event.paymentId LIKE :txRef", { txRef: `${txRefSearch}%` })
        .andWhere("event.eventType = :type", { type: "charge_succeeded" })
        .getOne();

      if (!event) throw new BadRequestException("Payment has not been completed for this appointment");

      const existingRefund = await manager.findOne(RefundEntity, { where: { paymentId: event.paymentId } });
      if (existingRefund) throw new BadRequestException("Payment is already refunded");

      const refund = new RefundEntity();
      refund.id = `ref-${crypto.randomUUID()}`;
      refund.paymentId = event.paymentId;
      refund.amount = apt.amount;
      refund.reason = reason;
      refund.status = "processed";
      refund.createdAt = new Date().toISOString();
      await manager.save(refund);

      apt.status = "cancelled";
      apt.cancelledBy = actorId;
      apt.cancellationReason = `Refunded. Reason: ${reason}`;
      await manager.save(apt);

      if (apt.providerId) {
        const rate = this.getCommissionRate();
        const commissionAmount = apt.amount * (rate / 100);
        const netEarnings = apt.amount - commissionAmount;

        const ledger = await manager.findOne(ProviderEarningsEntity, { where: { providerId: apt.providerId } });
        if (ledger) {
          ledger.balance = Math.max(0, ledger.balance - netEarnings);
          ledger.totalEarned = Math.max(0, ledger.totalEarned - netEarnings);
          ledger.updatedAt = new Date().toISOString();
          await manager.save(ledger);
        }
      }

      const logEvent = new PaymentEventEntity();
      logEvent.id = `evt-${crypto.randomUUID()}`;
      logEvent.paymentId = event.paymentId;
      logEvent.eventType = "charge_refunded";
      logEvent.payload = JSON.stringify({ reason, actorId, amount: apt.amount });
      logEvent.createdAt = new Date().toISOString();
      await manager.save(logEvent);

      return refund;
    });
  }
}
