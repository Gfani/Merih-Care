import { Controller, Get, Put, Param, Body, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsIn } from "class-validator";

export class ModerateReviewDto {
  @IsIn(["published", "hidden", "flagged"])
  status: "published" | "hidden" | "flagged";
}

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getReviews() {
    return this.reviewsService.getAllReviews();
  }

  @Put(":id/moderate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  async moderate(@Param("id") id: string, @Body() body: ModerateReviewDto) {
    return this.reviewsService.moderateReview(id, body.status);
  }
}
