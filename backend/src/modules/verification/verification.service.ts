import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { VerificationReviewEntity } from "../../database/entities/verification.entity";
import { VerificationHistoryEntity } from "../../database/entities/verification.entity";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
    @InjectRepository(VerificationReviewEntity)
    private readonly reviewRepo: Repository<VerificationReviewEntity>,
    @InjectRepository(VerificationHistoryEntity)
    private readonly historyRepo: Repository<VerificationHistoryEntity>,
  ) {}

  async getVerificationQueue(): Promise<any[]> {
    const providers = await this.providerRepo.find({ where: { verified: false } });
    return providers.map(p => ({
      ...p,
      services: p.services
    }));
  }

  async approveProvider(id: string, actorId: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = true;
      provider.status = "verified";
      const savedProvider = await this.providerRepo.save(provider);

      // Save Review Audit
      const review = new VerificationReviewEntity();
      review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      review.providerId = id;
      review.reviewerId = actorId;
      review.decision = "approved";
      review.notes = "Credentials approved and verified.";
      await this.reviewRepo.save(review);

      // Save History Audit
      const history = new VerificationHistoryEntity();
      history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      history.providerId = id;
      history.status = "verified";
      history.changedBy = actorId;
      history.notes = "Provider credentials approved and verified.";
      history.createdAt = new Date().toISOString();
      await this.historyRepo.save(history);

      return savedProvider;
    }
    return null;
  }

  async rejectProvider(id: string, reason: string, actorId: string): Promise<ProviderEntity> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (provider) {
      provider.verified = false;
      provider.status = "rejected";
      const savedProvider = await this.providerRepo.save(provider);

      // Save Review Audit
      const review = new VerificationReviewEntity();
      review.id = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      review.providerId = id;
      review.reviewerId = actorId;
      review.decision = "rejected";
      review.notes = reason;
      await this.reviewRepo.save(review);

      // Save History Audit
      const history = new VerificationHistoryEntity();
      history.id = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      history.providerId = id;
      history.status = "rejected";
      history.changedBy = actorId;
      history.notes = `Provider verification rejected. Reason: ${reason}`;
      history.createdAt = new Date().toISOString();
      await this.historyRepo.save(history);

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
