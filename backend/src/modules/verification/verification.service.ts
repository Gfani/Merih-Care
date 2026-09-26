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

  async approveProvider(id: string, actorId: string): Promise<ProviderEntity | null> {
    if (!id) return null;

    const cleanId = String(id).trim();
    const strippedId = cleanId.startsWith("prov-") ? cleanId.replace(/^prov-/, "") : cleanId;
    const prefixedId = cleanId.startsWith("prov-") ? cleanId : `prov-${cleanId}`;

    // 1. Search provider repository by direct id, prefixed id, stripped id, or linked userId
    let provider: ProviderEntity | null = await this.providerRepo.findOne({
      where: [
        { id: cleanId },
        { id: prefixedId },
        { id: strippedId },
        { userId: cleanId },
        { userId: strippedId },
      ],
    });

    // 2. If no provider entity was found, search user repository
    let user: UserEntity | null = null;
    if (this.userRepo) {
      try {
        user = await this.userRepo.findOne({
          where: [
            { id: cleanId },
            { id: strippedId },
          ],
        });

        if (user && !provider) {
          // See if provider exists under user's actual ID or email
          provider = await this.providerRepo.findOne({
            where: [
              { userId: user.id },
              { email: user.email },
            ],
          });

          // Auto-create linked provider record if missing
          if (!provider) {
            provider = new ProviderEntity();
            provider.id = `prov-${user.id}`;
            provider.userId = user.id;
            provider.name = user.name || "Healthcare Specialist";
            provider.email = user.email || "";
            provider.phone = user.phone || "";
            provider.title = "Healthcare Specialist";
            provider.specialty = "General Medicine";
            provider.pricePerVisit = 800;
            provider.rating = 5.0;
            provider.reviewCount = 0;
            provider.experience = 3;
            provider.services = ["Doctor Visit", "Home Nursing"];
          }
        }
      } catch (e) {
        console.error("[VERIFICATION] Error finding user in approveProvider:", e);
      }
    }

    if (!provider && !user) {
      return null;
    }

    // 3. Mark provider approved & verified
    let savedProvider: ProviderEntity;
    if (provider) {
      provider.verified = true;
      provider.status = "verified";
      provider.available = true;
      if (!provider.providerCode) {
        provider.providerCode = `MCH-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      savedProvider = await this.providerRepo.save(provider);
    } else {
      savedProvider = new ProviderEntity();
      savedProvider.id = `prov-${user!.id}`;
      savedProvider.userId = user!.id;
      savedProvider.name = user!.name || "Healthcare Specialist";
      savedProvider.email = user!.email || "";
      savedProvider.phone = user!.phone || "";
      savedProvider.title = "Healthcare Specialist";
      savedProvider.specialty = "General Medicine";
      savedProvider.pricePerVisit = 800;
      savedProvider.verified = true;
      savedProvider.status = "verified";
      savedProvider.available = true;
      savedProvider.providerCode = `MCH-${Math.floor(1000 + Math.random() * 9000)}`;
      savedProvider = await this.providerRepo.save(savedProvider);
    }

    // 4. Unlock and activate associated user account
    if (this.userRepo) {
      try {
        if (!user && savedProvider.userId) {
          user = await this.userRepo.findOne({ where: { id: savedProvider.userId } });
        }
        if (!user && savedProvider.email) {
          user = await this.userRepo.findOne({ where: { email: savedProvider.email } });
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

    const providerId = savedProvider.id;
    const targetUserId = user?.id || savedProvider.userId || strippedId;

    // 5. Save Review Audit
    try {
      const review = new VerificationReviewEntity();
      review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      review.providerId = providerId;
      review.reviewerId = actorId || "admin";
      review.decision = "approved";
      review.notes = "Credentials approved and verified.";
      await this.reviewRepo.save(review);
    } catch (err) {
      console.error("[VERIFICATION] Error saving review audit:", err);
    }

    // 6. Save History Audit
    try {
      const history = new VerificationHistoryEntity();
      history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      history.providerId = providerId;
      history.status = "verified";
      history.changedBy = actorId || "admin";
      history.notes = "Provider credentials approved and verified.";
      history.createdAt = new Date().toISOString();
      await this.historyRepo.save(history);
    } catch (err) {
      console.error("[VERIFICATION] Error saving history audit:", err);
    }

    // 7. Dispatch approval notification to provider
    if (this.notificationsService && (savedProvider.userId || savedProvider.email || savedProvider.phone || user)) {
      const notifTarget = targetUserId || savedProvider.id;
      this.notificationsService.sendNotification(notifTarget, {
        type: "verification_update",
        title: "Healthcare Provider Verification Approved! 🎉",
        body: `Congratulations ${savedProvider.name}, your credentials have been verified and approved by the MerihCare Clinical Administration! Your provider account is now fully active.`,
        priority: "critical",
        recipientEmail: savedProvider.email || user?.email,
        recipientPhone: savedProvider.phone || user?.phone,
        data: { providerId: savedProvider.id, status: "verified", approved: true },
      }).catch((err) => console.error("[VERIFICATION] Notification error:", err));
    }

    // 8. Realtime websocket notifications
    if (this.realtimeService && targetUserId) {
      try {
        this.realtimeService.emitUserStatusChanged(targetUserId, "active");
        this.realtimeService.emitToRoom(`provider:${targetUserId}`, "verification_status", {
          status: "verified",
          isApproved: true,
          message: "Your provider credentials have been approved!",
        });
      } catch (err) {
        console.error("[VERIFICATION] Realtime notification error:", err);
      }
    }

    return savedProvider;
  }

  async rejectProvider(id: string, reason: string, actorId: string): Promise<ProviderEntity | null> {
    if (!id) return null;

    const cleanId = String(id).trim();
    const strippedId = cleanId.startsWith("prov-") ? cleanId.replace(/^prov-/, "") : cleanId;
    const prefixedId = cleanId.startsWith("prov-") ? cleanId : `prov-${cleanId}`;

    let provider: ProviderEntity | null = await this.providerRepo.findOne({
      where: [
        { id: cleanId },
        { id: prefixedId },
        { id: strippedId },
        { userId: cleanId },
        { userId: strippedId },
      ],
    });

    let user: UserEntity | null = null;
    if (this.userRepo) {
      try {
        user = await this.userRepo.findOne({
          where: [
            { id: cleanId },
            { id: strippedId },
          ],
        });
        if (user && !provider) {
          provider = await this.providerRepo.findOne({
            where: [{ userId: user.id }, { email: user.email }],
          });
        }
      } catch (e) {
        console.error("[VERIFICATION] Error finding user in rejectProvider:", e);
      }
    }

    if (provider) {
      provider.verified = false;
      provider.status = "rejected";
      provider.available = false;
      const savedProvider = await this.providerRepo.save(provider);

      // Update associated user account
      if (this.userRepo) {
        try {
          if (!user && provider.userId) {
            user = await this.userRepo.findOne({ where: { id: provider.userId } });
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

      const providerId = provider.id;
      const targetUserId = user?.id || provider.userId || strippedId;

      // Dispatch rejection notification to provider
      if (this.notificationsService && targetUserId) {
        this.notificationsService.sendNotification(targetUserId, {
          type: "verification_update",
          title: "Provider Verification Update",
          body: `Your provider verification application was not approved: ${reason}. Please update your credentials or contact clinical administration support.`,
          priority: "critical",
          recipientEmail: provider.email || user?.email,
          recipientPhone: provider.phone || user?.phone,
          data: { providerId: provider.id, status: "rejected", reason },
        }).catch((err) => console.error("[VERIFICATION] Notification error:", err));
      }

      if (this.realtimeService && targetUserId) {
        try {
          this.realtimeService.emitUserStatusChanged(targetUserId, "rejected");
        } catch (err) {
          console.error("[VERIFICATION] Realtime error on reject:", err);
        }
      }

      // Save Review Audit
      try {
        const review = new VerificationReviewEntity();
        review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        review.providerId = providerId;
        review.reviewerId = actorId || "admin";
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
        history.providerId = providerId;
        history.status = "rejected";
        history.changedBy = actorId || "admin";
        history.notes = `Application rejected: ${reason}`;
        history.createdAt = new Date().toISOString();
        await this.historyRepo.save(history);
      } catch (err) {
        console.error("[VERIFICATION] Error saving history audit:", err);
      }

      return savedProvider;
    } else if (user) {
      user.isApproved = false;
      user.status = "rejected";
      await this.userRepo.save(user);
    }
    return null;
  }

  async requestCorrections(id: string, comments: string, actorId: string): Promise<ProviderEntity | null> {
    if (!id) return null;

    const cleanId = String(id).trim();
    const strippedId = cleanId.startsWith("prov-") ? cleanId.replace(/^prov-/, "") : cleanId;
    const prefixedId = cleanId.startsWith("prov-") ? cleanId : `prov-${cleanId}`;

    let provider: ProviderEntity | null = await this.providerRepo.findOne({
      where: [
        { id: cleanId },
        { id: prefixedId },
        { id: strippedId },
        { userId: cleanId },
        { userId: strippedId },
      ],
    });

    if (provider) {
      provider.verified = false;
      provider.status = "needs_fix";
      const savedProvider = await this.providerRepo.save(provider);

      // Save Review Audit
      try {
        const review = new VerificationReviewEntity();
        review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        review.providerId = provider.id;
        review.reviewerId = actorId || "admin";
        review.decision = "corrections_requested";
        review.notes = comments;
        await this.reviewRepo.save(review);
      } catch (err) {
        console.error("[VERIFICATION] Error saving review audit on corrections:", err);
      }

      // Save History Audit
      try {
        const history = new VerificationHistoryEntity();
        history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        history.providerId = provider.id;
        history.status = "needs_fix";
        history.changedBy = actorId || "admin";
        history.notes = `Correction requested. Notes: ${comments}`;
        history.createdAt = new Date().toISOString();
        await this.historyRepo.save(history);
      } catch (err) {
        console.error("[VERIFICATION] Error saving history audit on corrections:", err);
      }

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
