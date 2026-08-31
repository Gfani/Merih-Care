import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReviewsService } from "./reviews.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewEntity } from "../../database/entities/review.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity, ProviderEntity]),
    AuthModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
