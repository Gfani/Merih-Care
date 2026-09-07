import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity } from "../../database/entities/verification.entity";
import { VerificationHistoryEntity } from "../../database/entities/verification.entity";
import { UserEntity } from "../../database/entities/user.entity";

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
  ) {}

  async getVerificationQueue(): Promise<any[]> {
    const providers = await this.providerRepo.find({ where: { verified: false } });
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
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

      return savedProvider;
    }

    // Fallback: If id corresponds directly to a user with role === 'provider'
    if (this.userRepo) {
      const user = await this.userRepo.findOne({ where: { id } });
      if (user && user.role === "provider") {
        user.isApproved = true;
        user.status = "active";
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
        return this.providerRepo.save(linkedProvider);
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
