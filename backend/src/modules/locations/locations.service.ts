import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LocationEntity } from "../../database/entities/location.entity";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private readonly locationRepo: Repository<LocationEntity>,
  ) {}

  async getAllLocations(): Promise<LocationEntity[]> {
    return this.locationRepo.find();
  }

  async updateLocation(id: string, x: number, y: number): Promise<LocationEntity> {
    const loc = await this.locationRepo.findOne({ where: { id } });
    if (loc) {
      loc.x = x;
      loc.y = y;
      return this.locationRepo.save(loc);
    }
    return null;
  }
}
