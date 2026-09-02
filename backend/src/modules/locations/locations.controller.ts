import { Controller, Get, Post, Put, Param, Body, UseGuards, Query, Req } from "@nestjs/common";
import { LocationsService } from "./locations.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNumber, Min, Max, IsOptional, IsBoolean, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class MoveLocationDto {
  @ApiProperty({ description: "Latitude coordinate from -90 to 90 degrees" })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: "Longitude coordinate from -180 to 180 degrees" })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ required: false, description: "Location accuracy range in meters" })
  @IsNumber()
  @IsOptional()
  accuracy?: number;
}

export class UpdatePrivacyDto {
  @ApiProperty({ description: "Privacy mode toggle (masks exact GPS coordinate)" })
  @IsBoolean()
  privacyMode: boolean;
}

export class UpdateStatusDto {
  @ApiProperty({ description: "Provider current status" })
  @IsString()
  status: string; // available, busy, critical, offline
}

@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getLocations() {
    return this.locationsService.getAllLocations();
  }

  @Put("privacy")
  @UseGuards(JwtAuthGuard)
  async updatePrivacy(@Req() req: any, @Body() body: UpdatePrivacyDto) {
    const userId = req.user?.id || req.user?.sub;
    return this.locationsService.setPrivacyMode(userId, body.privacyMode);
  }

  @Put("status")
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Req() req: any, @Body() body: UpdateStatusDto) {
    const userId = req.user?.id || req.user?.sub;
    return this.locationsService.setStatus(userId, body.status);
  }

  @Put(":id/move")
  @UseGuards(JwtAuthGuard)
  async move(@Param("id") id: string, @Body() body: MoveLocationDto) {
    return this.locationsService.updateLocation(
      id,
      body.latitude,
      body.longitude,
      body.accuracy || 0,
    );
  }

  @Get("route")
  async getRoute(
    @Query("lat1") lat1: string,
    @Query("lon1") lon1: string,
    @Query("lat2") lat2: string,
    @Query("lon2") lon2: string,
  ) {
    const l1 = parseFloat(lat1);
    const n1 = parseFloat(lon1);
    const l2 = parseFloat(lat2);
    const n2 = parseFloat(lon2);
    return this.locationsService.calculateDistanceAndEta(l1, n1, l2, n2);
  }

  @Post("route")
  async calculateRoutePost(@Body() body: any) {
    const lat1 = body?.origin?.latitude ?? body?.origin?.lat ?? body?.origin?.y ?? body?.lat1 ?? 9.0192;
    const lon1 = body?.origin?.longitude ?? body?.origin?.lng ?? body?.origin?.lon ?? body?.origin?.x ?? body?.lon1 ?? 38.7578;
    const lat2 = body?.destination?.latitude ?? body?.destination?.lat ?? body?.destination?.y ?? body?.lat2 ?? 9.0300;
    const lon2 = body?.destination?.longitude ?? body?.destination?.lng ?? body?.destination?.lon ?? body?.destination?.x ?? body?.lon2 ?? 38.7400;
    return this.locationsService.calculateDistanceAndEta(Number(lat1), Number(lon1), Number(lat2), Number(lon2));
  }

  @Get("geofence")
  async checkGeofence(
    @Query("lat1") lat1: string,
    @Query("lon1") lon1: string,
    @Query("lat2") lat2: string,
    @Query("lon2") lon2: string,
    @Query("radius") radius?: string,
  ) {
    const l1 = parseFloat(lat1);
    const n1 = parseFloat(lon1);
    const l2 = parseFloat(lat2);
    const n2 = parseFloat(lon2);
    const r = radius ? parseInt(radius) : 100;
    return this.locationsService.checkGeofenceArrival(l1, n1, l2, n2, r);
  }

  @Get("emergencies")
  async getEmergencies() {
    return this.locationsService.getEmergencyOverlays();
  }
}
