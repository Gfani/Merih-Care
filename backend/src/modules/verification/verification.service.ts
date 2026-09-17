import { Injectable, Optional, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity } from "../../database/entities/verification.entity";
import { VerificationHistoryEntity } from "../../database/entities/verification.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
    @InjectRepository(VerificationReviewEntity)
    private readonly reviewRepo: Repository<VerificationReviewEntity>,
    @InjectRepository(VerificationHistoryEntity)
    private readonly historyRepo: Repository<VerificationHistoryEntity>,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly realtimeService?: RealtimeService,
  ) {}

  private normalizeDocUrl(url?: string): string {
    if (!url || !url.trim()) return "";
    let fileKey = url.trim();

    if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) {
      fileKey = fileKey.replace(/^https?:\/\/[^/]+/, "");
    }
    if (fileKey.includes("?")) {
      fileKey = fileKey.split("?")[0];
    }
    if (fileKey.includes("/api/v1/")) {
      fileKey = fileKey.split("/api/v1/")[1];
    }
    if (fileKey.includes("/uploads/view/")) {
      fileKey = fileKey.split("/uploads/view/")[1];
    }
    if (fileKey.includes("/uploads/download/")) {
      fileKey = fileKey.split("/uploads/download/")[1];
    }
    if (fileKey.includes("/signed/")) {
      fileKey = fileKey.split("/signed/")[1];
    }
    if (fileKey.includes("/credentials/")) {
      fileKey = "credentials/" + fileKey.split("/credentials/")[1];
    }
    fileKey = decodeURIComponent(fileKey).replace(/^\/+/, "");

    const port = process.env.PORT || 3000;
    const apiBase =
      process.env.API_BASE_URL ||
      (process.env.NODE_ENV === "production" || process.env.CONTAINER_APP_NAME
        ? "https://api.merihcare.live/api/v1"
        : `http://localhost:${port}/api/v1`);

    return `${apiBase}/uploads/view/${encodeURIComponent(fileKey)}`;
  }

  async getVerificationQueue(): Promise<any[]> {
    const allProviders = await this.providerRepo.find({
      relations: ["user"],
    });

    // Match all providers who require credential verification
    const pendingProviders = allProviders.filter(
      (p) => !p.verified || p.status === "pending_verification" || p.status === "pending" || p.status === "needs_fix"
    );

    const results: any[] = [];
    const seenUserIds = new Set<string>();

    for (const p of pendingProviders) {
      let user: UserEntity | null = p.user || null;
      if (!user && this.userRepo && p.userId) {
        user = await this.userRepo.findOne({ where: { id: p.userId } }).catch(() => null);
      }

      if (user?.id) seenUserIds.add(user.id);
      if (p.userId) seenUserIds.add(p.userId);

      const email = p.email || user?.email || "";
      const phone = p.phone || user?.phone || "";

      results.push({
        id: p.id,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        title: p.title,
        specialty: p.specialty,
        licenseNumber: p.licenseNumber,
        experience: p.experience,
        education: p.education,
        hospitalAffiliation: p.hospitalAffiliation,
        pricePerVisit: p.pricePerVisit,
        email,
        phone,
        providerCode: p.providerCode || null,
        emailVerified: user?.emailVerified ?? false,
        isApproved: user?.isApproved ?? false,
        joinedDate: user?.dateJoined || (p.createdAt ? p.createdAt.toISOString().split("T")[0] : ""),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        status: p.status,
        verified: p.verified,
        available: p.available,
        services: p.services,
        cvUrl: this.normalizeDocUrl(p.cvUrl),
        licenseDocumentUrl: this.normalizeDocUrl(p.licenseDocumentUrl),
        idDocumentUrl: this.normalizeDocUrl(p.idDocumentUrl),
      });
    }

    // Also include any users registered with role: "provider" awaiting verification who don't yet have a provider record
    if (this.userRepo) {
      try {
        const pendingUsers = await this.userRepo.find({
          where: [
            { role: "provider", isApproved: false },
            { role: "provider", status: "pending_verification" },
          ],
        });

        for (const u of pendingUsers) {
          if (seenUserIds.has(u.id)) continue;
          seenUserIds.add(u.id);

          results.push({
            id: `prov-${u.id}`,
            userId: u.id,
            name: u.name,
            avatar: "",
            title: "Healthcare Specialist",
            specialty: "General Medicine",
            licenseNumber: "",
            experience: 0,
            education: "",
            hospitalAffiliation: "",
            pricePerVisit: 800,
            email: u.email || "",
            phone: u.phone || "",
            emailVerified: u.emailVerified ?? false,
            isApproved: u.isApproved ?? false,
            joinedDate: u.dateJoined || "",
            createdAt: new Date(),
            updatedAt: new Date(),
            status: u.status || "pending_verification",
            verified: false,
            available: false,
            services: ["Doctor Visit", "Home Nursing"],
            cvUrl: "",
            licenseDocumentUrl: "",
            idDocumentUrl: "",
          });
        }
      } catch (err) {
        console.error("[VERIFICATION] Error querying pending provider users:", err);
      }
    }

    return results;
  }

  async approveProvider(id: string, actorId: string): Promise<ProviderEntity> {
    let provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) {
      provider = await this.providerRepo.findOne({ where: { userId: id } });
    }

    if (provider) {
      provider.verified = true;
      provider.status = "verified";
      provider.available = true;
      const savedProvider = await this.providerRepo.save(provider);

      // Unlock associated user account
      if (this.userRepo) {
        try {
          let user: UserEntity | null = null;
          if (provider.userId) {
            user = await this.userRepo.findOne({ where: { id: provider.userId } });
          }
          if (!user && provider.name) {
            user = await this.userRepo.findOne({ where: { name: provider.name, role: "provider" } });
          }
          if (!user) {
            user = await this.userRepo.findOne({ where: { id } });
          }
          if (user) {
            user.isApproved = true;
            user.status = "active";
            user.emailVerified = true;
            await this.userRepo.save(user);
            console.log(`[VERIFICATION] Approved and activated provider user: ${user.id} (${user.email})`);
          }
        } catch (e) {
          console.error("[VERIFICATION] Error approving user account:", e);
        }
      }

      // Save Review Audit
      try {
        const review = new VerificationReviewEntity();
        review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        review.providerId = provider.id;
        review.reviewerId = actorId;
        review.decision = "approved";
        review.notes = "Credentials approved and verified.";
        await this.reviewRepo.save(review);
      } catch (err) {
        console.error("[VERIFICATION] Error saving review audit:", err);
      }

      // Save History Audit
      try {
        const history = new VerificationHistoryEntity();
        history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        history.providerId = provider.id;
        history.status = "verified";
        history.changedBy = actorId;
        history.notes = "Provider credentials approved and verified.";
        history.createdAt = new Date().toISOString();
        await this.historyRepo.save(history);
      } catch (err) {
        console.error("[VERIFICATION] Error saving history audit:", err);
      }

      // Dispatch approval notification to provider
      if (this.notificationsService && (provider.userId || provider.email || provider.phone)) {
        const targetId = provider.userId || provider.id;
        this.notificationsService.sendNotification(targetId, {
          type: "verification_update",
          title: "Healthcare Provider Verification Approved! 🎉",
          body: `Congratulations ${provider.name}, your credentials have been verified and approved by the MerihCare Clinical Administration! Your provider account is now fully active.`,
          priority: "critical",
          recipientEmail: provider.email,
          recipientPhone: provider.phone,
          data: { providerId: provider.id, status: "verified", approved: true },
        }).catch((err) => console.error("[VERIFICATION] Notification error:", err));
      }

      // Realtime websocket notifications
      if (this.realtimeService) {
        const targetUserId = provider.userId || provider.id;
        this.realtimeService.emitUserStatusChanged(targetUserId, "active");
        this.realtimeService.emitToRoom(`provider:${targetUserId}`, "verification_status", {
          status: "verified",
          isApproved: true,
          message: "Your provider credentials have been approved!",
        });
      }

      return savedProvider;
    }

    // Fallback: If id corresponds directly to a user with role === 'provider'
    if (this.userRepo) {
      const user = await this.userRepo.findOne({ where: { id } });
      if (user && user.role === "provider") {
        user.isApproved = true;
        user.status = "active";
        user.emailVerified = true;
        await this.userRepo.save(user);

        let linkedProvider = await this.providerRepo.findOne({ where: { userId: user.id } });
        if (!linkedProvider) {
          linkedProvider = new ProviderEntity();
          linkedProvider.id = "prov-" + Date.now();
          linkedProvider.userId = user.id;
          linkedProvider.name = user.name;
          linkedProvider.title = "Healthcare Specialist";
          linkedProvider.pricePerVisit = 800;
          linkedProvider.services = ["Doctor Visit", "Home Nursing"];
        }
        linkedProvider.verified = true;
        linkedProvider.status = "verified";
        linkedProvider.available = true;
        const saved = await this.providerRepo.save(linkedProvider);

        if (this.realtimeService) {
          this.realtimeService.emitUserStatusChanged(user.id, "active");
        }
        return saved;
      }
    }

    return null;
  }

  async rejectProvider(id: string, reason: string, actorId: string): Promise<ProviderEntity> {
    let provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) {
      provider = await this.providerRepo.findOne({ where: { userId: id } });
    }

    if (provider) {
      provider.verified = false;
      provider.status = "rejected";
      provider.available = false;
      const savedProvider = await this.providerRepo.save(provider);

      // Update associated user account
      if (this.userRepo) {
        try {
          let user: UserEntity | null = null;
          if (provider.userId) {
            user = await this.userRepo.findOne({ where: { id: provider.userId } });
          }
          if (!user && provider.name) {
            user = await this.userRepo.findOne({ where: { name: provider.name, role: "provider" } });
          }
          if (!user) {
            user = await this.userRepo.findOne({ where: { id } });
          }
          if (user) {
            user.isApproved = false;
            user.status = "rejected";
            await this.userRepo.save(user);
          }
        } catch (e) {
          console.error("[VERIFICATION] Error updating rejected user account:", e);
        }
      }

      // Dispatch rejection notification to provider
      if (this.notificationsService && (provider.userId || provider.email || provider.phone)) {
        const targetId = provider.userId || provider.id;
        this.notificationsService.sendNotification(targetId, {
          type: "verification_update",
          title: "Provider Verification Update",
          body: `Your provider verification application was not approved: ${reason}. Please update your credentials or contact clinical administration support.`,
          priority: "critical",
          recipientEmail: provider.email,
          recipientPhone: provider.phone,
          data: { providerId: provider.id, status: "rejected", reason },
        }).catch((err) => console.error("[VERIFICATION] Notification error:", err));
      }

      if (this.realtimeService) {
        const targetUserId = provider.userId || provider.id;
        this.realtimeService.emitUserStatusChanged(targetUserId, "rejected");
      }

      // Save Review Audit
      try {
        const review = new VerificationReviewEntity();
        review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        review.providerId = provider.id;
        review.reviewerId = actorId;
        review.decision = "rejected";
        review.notes = reason;
        await this.reviewRepo.save(review);
      } catch (err) {
        console.error("[VERIFICATION] Error saving review audit:", err);
      }

      // Save History Audit
      try {
        const history = new VerificationHistoryEntity();
        history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        history.providerId = provider.id;
        history.status = "rejected";
        history.changedBy = actorId;
        history.notes = `Application rejected: ${reason}`;
        history.createdAt = new Date().toISOString();
        await this.historyRepo.save(history);
      } catch (err) {
        console.error("[VERIFICATION] Error saving history audit:", err);
      }

      return savedProvider;
    }
    return null;
  }

  async requestCorrections(id: string, comments: string, actorId: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = false;
      provider.status = "needs_fix";
      const savedProvider = await this.providerRepo.save(provider);

      // Save Review Audit
      const review = new VerificationReviewEntity();
      review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      review.providerId = id;
      review.reviewerId = actorId;
      review.decision = "corrections_requested";
      review.notes = comments;
      await this.reviewRepo.save(review);

      // Save History Audit
      const history = new VerificationHistoryEntity();
      history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      history.providerId = id;
      history.status = "needs_fix";
      history.changedBy = actorId;
      history.notes = `Correction requested. Notes: ${comments}`;
      history.createdAt = new Date().toISOString();
      await this.historyRepo.save(history);

      return savedProvider;
    }
    return null;
  }

  async assignReviewer(providerId: string, reviewerId: string, actorId: string): Promise<any> {
    const provider = await this.providerRepo.findOne({ where: { id: providerId } });
    if (!provider) return null;

    const review = new VerificationReviewEntity();
    review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    review.providerId = providerId;
    review.reviewerId = reviewerId;
    review.decision = "under_review";
    review.notes = `Assigned reviewer: ${reviewerId} by ${actorId}`;
    await this.reviewRepo.save(review);

    const history = new VerificationHistoryEntity();
    history.id = `hist-${Date.now()}`;
    history.providerId = providerId;
    history.status = "under_review";
    history.changedBy = actorId;
    history.notes = `Reviewer ${reviewerId} assigned.`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return { success: true, providerId, assignedReviewerId: reviewerId };
  }

  async sanctionProvider(
    providerId: string,
    reason: string,
    sanctionType: string,
    actorId: string
  ): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id: providerId } });
    if (provider) {
      provider.verified = false;
      provider.status = sanctionType || "suspended";
      const saved = await this.providerRepo.save(provider);

      const review = new VerificationReviewEntity();
      review.id = `rev-${Date.now()}`;
      review.providerId = providerId;
      review.reviewerId = actorId;
      review.decision = sanctionType || "sanctioned";
      review.notes = reason;
      await this.reviewRepo.save(review);

      const history = new VerificationHistoryEntity();
      history.id = `hist-${Date.now()}`;
      history.providerId = providerId;
      history.status = sanctionType || "suspended";
      history.changedBy = actorId;
      history.notes = `Compliance sanction applied: ${reason}`;
      history.createdAt = new Date().toISOString();
      await this.historyRepo.save(history);

      return saved;
    }
    return null;
  }

  async getExpiringLicenses(): Promise<any[]> {
    const all = await this.providerRepo.find();
    // Return verified providers with upcoming license review dates
    return all.filter((p) => p.verified).map((p) => ({
      providerId: p.id,
      name: p.name,
      title: p.title,
      status: p.status,
      complianceStatus: "active",
      reviewDueInDays: 30,
    }));
  }
}
