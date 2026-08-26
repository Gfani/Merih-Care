import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReviewEntity } from "../../database/entities/review.entity";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepo: Repository<ReviewEntity>,
  ) {}

  async getAllReviews(): Promise<ReviewEntity[]> {
    return this.reviewRepo.find();
  }

  async moderateReview(id: string, status: "published" | "hidden" | "flagged"): Promise<ReviewEntity> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (review) {
      review.status = status;
      return this.reviewRepo.save(review);
    }
    return null;
  }
}
