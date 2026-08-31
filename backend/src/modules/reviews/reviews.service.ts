import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReviewEntity } from "../../database/entities/review.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepo: Repository<ReviewEntity>,
    @InjectRepository(ProviderEntity)
    private readonly providerRepo: Repository<ProviderEntity>,
  ) {}

  async getAllReviews(): Promise<ReviewEntity[]> {
    return this.reviewRepo.find();
  }

  async moderateReview(id: string, status: "published" | "hidden" | "flagged"): Promise<ReviewEntity> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");

    review.status = status;
    const savedReview = await this.reviewRepo.save(review);

    // Recalculate provider aggregate rating based on active published reviews
    await this.recalculateProviderRating(review.providerId);

    return savedReview;
  }

  async recalculateProviderRating(providerId: string): Promise<void> {
    const publishedReviews = await this.reviewRepo.find({
      where: { providerId, status: "published" },
    });

    const provider = await this.providerRepo.findOne({ where: { id: providerId } });
    if (provider) {
      if (publishedReviews.length === 0) {
        provider.rating = 5.0;
        provider.reviewCount = 0;
      } else {
        const sum = publishedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
        provider.rating = Math.round((sum / publishedReviews.length) * 10) / 10;
        provider.reviewCount = publishedReviews.length;
      }
      await this.providerRepo.save(provider);
    }
  }
}
