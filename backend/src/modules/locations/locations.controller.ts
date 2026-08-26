import { Controller, Get, Put, Param, Body, UseGuards } from "@nestjs/common";
import { LocationsService } from "./locations.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNumber, Min, Max } from "class-validator";

export class MoveLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  x: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  y: number;
}

@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getLocations() {
    return this.locationsService.getAllLocations();
  }

  @Put(":id/move")
  @UseGuards(JwtAuthGuard)
  async move(@Param("id") id: string, @Body() body: MoveLocationDto) {
    return this.locationsService.updateLocation(id, body.x, body.y);
  }
}
