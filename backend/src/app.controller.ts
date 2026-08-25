import { Controller, Get, Post, Put, Body, Param, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // ─── AUTH ──────────────────────────────────────────────────────────────────────
  @Post("auth/login")
  async login(@Body() body: any) {
    const user = await this.appService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials or suspended account");
    }
    // Return mock access token and name details
    return {
      access_token: "mock-jwt-token-xyz",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    };
  }

  @Post("auth/signup")
  async signup(@Body() body: any) {
    try {
      const user = await this.appService.registerUser(body.name, body.email, body.password, "admin");
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  // ─── USERS ─────────────────────────────────────────────────────────────────────
  @Get("users")
  async getUsers() {
    return this.appService.getAllUsers();
  }

  @Put("users/:id/suspend")
  async suspendUser(@Param("id") id: string) {
    return this.appService.toggleUserSuspension(id);
  }

  // ─── PROVIDERS ─────────────────────────────────────────────────────────────────
  @Get("providers")
  async getProviders() {
    return this.appService.getAllProviders();
  }

  @Put("providers/:id/suspend")
  async suspendProvider(@Param("id") id: string) {
    return this.appService.toggleProviderSuspension(id);
  }

  // ─── VERIFICATIONS ─────────────────────────────────────────────────────────────
  @Get("verification")
  async getVerifications() {
    return this.appService.getVerificationQueue();
  }

  @Post("verification/:id/approve")
  async approve(@Param("id") id: string) {
    return this.appService.approveProvider(id);
  }

  @Post("verification/:id/reject")
  async reject(@Param("id") id: string) {
    return this.appService.rejectProvider(id);
  }

  // ─── SERVICES ──────────────────────────────────────────────────────────────────
  @Get("services")
  async getServices() {
    return this.appService.getAllServices();
  }

  @Put("services/:id/toggle")
  async toggleService(@Param("id") id: string) {
    return this.appService.toggleServiceActive(id);
  }

  // ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
  @Get("appointments")
  async getAppointments() {
    return this.appService.getAllAppointments();
  }

  // ─── COMPLAINTS ────────────────────────────────────────────────────────────────
  @Get("complaints")
  async getComplaints() {
    return this.appService.getAllComplaints();
  }

  @Put("complaints/:id/resolve")
  async resolve(@Param("id") id: string) {
    return this.appService.resolveComplaint(id);
  }

  // ─── REVIEWS ───────────────────────────────────────────────────────────────────
  @Get("reviews")
  async getReviews() {
    return this.appService.getAllReviews();
  }

  @Put("reviews/:id/moderate")
  async moderate(@Param("id") id: string, @Body() body: any) {
    return this.appService.moderateReview(id, body.status);
  }

  // ─── EMERGENCIES ───────────────────────────────────────────────────────────────
  @Get("emergency")
  async getEmergencies() {
    return this.appService.getAllEmergencies();
  }

  @Put("emergency/:id/dispatch")
  async dispatch(@Param("id") id: string, @Body() body: any) {
    return this.appService.dispatchEmergency(id, body.responder);
  }

  // ─── LOCATIONS (LIVE MAP) ──────────────────────────────────────────────────────
  @Get("locations")
  async getLocations() {
    return this.appService.getAllLocations();
  }

  @Put("locations/:id/move")
  async move(@Param("id") id: string, @Body() body: any) {
    return this.appService.updateLocation(id, body.x, body.y);
  }
}
