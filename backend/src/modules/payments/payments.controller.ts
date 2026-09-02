import { Controller, Get, Post, Param, Body, UseGuards, Req, Headers } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class InitializePaymentDto {
  @ApiProperty({ description: "Target appointment ID to pay for" })
  @IsNotEmpty()
  @IsString()
  appointmentId: string;
}

export class ProcessDirectPaymentDto {
  @ApiProperty({ description: "Target appointment ID to pay for" })
  @IsNotEmpty()
  @IsString()
  appointmentId: string;

  @ApiProperty({ description: "Payment method: telebirr, cbe_birr, chapa, cash" })
  @IsNotEmpty()
  @IsString()
  method: string;

  @ApiProperty({ description: "Optional phone / account number", required: false })
  @IsString()
  accountNumber?: string;
}

export class RefundPaymentDto {
  @ApiProperty({ description: "Reason for the refund" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason: string;
}

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "finance_admin")
  async getPayments() {
    return this.paymentsService.getTransactions();
  }

  @Get("receipts")
  @UseGuards(JwtAuthGuard)
  async getReceipts(@Req() req: any) {
    return this.paymentsService.getTransactions();
  }

  @Get("receipt/:txRef")
  @UseGuards(JwtAuthGuard)
  async getReceipt(@Param("txRef") txRef: string) {
    return this.paymentsService.getReceipt(txRef);
  }

  @Post("initialize")
  @UseGuards(JwtAuthGuard)
  async initializePayment(@Body() body: InitializePaymentDto, @Req() req: any) {
    const actorId = req.user?.id || "unknown";
    return this.paymentsService.initializePayment(body.appointmentId, actorId);
  }

  @Post("process-direct")
  @UseGuards(JwtAuthGuard)
  async processDirect(@Body() body: ProcessDirectPaymentDto, @Req() req: any) {
    const actorId = req.user?.id || "patient";
    return this.paymentsService.processDirectPayment(body.appointmentId, body.method, actorId, body.accountNumber);
  }

  @Get("verify/:txRef")
  @UseGuards(JwtAuthGuard)
  async verifyPayment(@Param("txRef") txRef: string) {
    return this.paymentsService.verifyPayment(txRef);
  }

  @Post("webhook")
  async handleWebhook(
    @Body() body: any,
    @Headers("x-chapa-signature") chapaSignature: string,
    @Req() req: any
  ) {
    // In NestJS, to compute HMAC on the raw request body, we can pass the rawBody parsed
    // or use the stringified body if standard parser is used.
    const rawBody = req.rawBody || JSON.stringify(body);
    return this.paymentsService.handleWebhook(body, rawBody, chapaSignature);
  }

  @Post(":id/refund")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "finance_admin")
  async refundPayment(@Param("id") id: string, @Body() body: RefundPaymentDto, @Req() req: any) {
    const actorId = req.user?.id || "admin";
    return this.paymentsService.refundPayment(id, body.reason, actorId);
  }
}
