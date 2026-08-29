export type UserRole = "patient" | "provider" | "admin" | "super_admin" | "finance_admin" | "verifier";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: "active" | "suspended" | "pending";
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface Provider {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  specialty?: string;
  rating: number;
  reviewCount: number;
  experience?: number;
  pricePerVisit?: number;
  distance?: string;
  avatar?: string;
  status: "verified" | "pending" | "rejected" | "suspended";
  verified: boolean;
  licenseNumber?: string;
  serviceArea?: string;
  completedServices?: number;
  joinedDate?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  service: string;
  date: string;
  time: string;
  location: string;
  status: "requested" | "searching" | "accepted" | "scheduled" | "on_the_way" | "arrived" | "in_progress" | "completed" | "cancelled" | "rejected";
  paymentStatus: "paid" | "pending" | "failed" | "refunded";
  amount: number;
  notes?: string;
  duration?: string;
  createdAt?: string;
}

export interface ServiceRequest {
  id: string;
  patientId: string;
  patientName: string;
  service: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  estimatedEarnings: number;
  distance: string;
  status: Appointment["status"];
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon?: string;
  description: string;
  providerCount: number;
  priceFrom: number;
  color?: string;
  active?: boolean;
}

export interface PaymentTransaction {
  id: string;
  transactionRef: string;
  appointmentId: string;
  patientName: string;
  providerName: string;
  amount: number;
  platformFee: number;
  providerPayout: number;
  paymentMethod: "telebirr" | "cbe_birr" | "chapa" | "cash" | "card";
  status: "completed" | "pending" | "failed" | "refunded";
  createdAt: string;
  refundReason?: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  appointmentId: string;
  amount: number;
  reason: string;
  status: "pending" | "processed" | "rejected";
  processedBy?: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  targetId?: string;
  targetName?: string;
  type: "patient_provider" | "provider_patient" | "billing" | "service_quality";
  title: string;
  description: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  priority: "low" | "medium" | "high" | "urgent";
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  appointmentId: string;
  patientName: string;
  providerName: string;
  rating: number;
  comment: string;
  status: "published" | "flagged" | "hidden";
  createdAt: string;
}

export interface EmergencyAlert {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  severity: "critical" | "high" | "moderate";
  coordinates: { latitude: number; longitude: number };
  locationDescription: string;
  status: "active" | "dispatched" | "resolved";
  responderName?: string;
  triggeredAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: "emergency" | "verification" | "complaint" | "system" | "payment";
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface SystemSettings {
  platformName: string;
  supportPhone: string;
  supportEmail: string;
  commissionPercentage: number;
  surgePricingEnabled: boolean;
  maintenanceMode: boolean;
  autoDispatchEnabled: boolean;
  maxSearchRadiusKm: number;
}
