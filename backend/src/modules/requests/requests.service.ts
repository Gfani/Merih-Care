import { Injectable } from "@nestjs/common";

@Injectable()
export class ServiceRequestsService {
  getServiceRequests() {
    return [
      {
        id: "req1",
        patientId: "u3",
        patientName: "Selamawit Tadesse",
        patientAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&auto=format",
        service: "Home Nursing",
        date: "2026-08-26",
        time: "16:00",
        location: "Megenagna, Addis Ababa",
        notes: "Post-surgery wound care and dressing change",
        estimatedEarnings: 750,
        distance: "1.4 km",
        status: "pending",
        createdAt: "2026-08-25T08:14:00",
      },
      {
        id: "req2",
        patientId: "u5",
        patientName: "Frehiwot Solomon",
        patientAvatar: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=200&h=200&fit=crop&auto=format",
        service: "Medication Assist",
        date: "2026-08-26",
        time: "12:00",
        location: "Piazza, Addis Ababa",
        notes: "Daily insulin injection management for elderly parent",
        estimatedEarnings: 380,
        distance: "3.2 km",
        status: "pending",
        createdAt: "2026-08-25T07:30:00",
      },
      {
        id: "req3",
        patientId: "u2",
        patientName: "Dawit Haile",
        patientAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format",
        service: "Wound Care",
        date: "2026-08-27",
        time: "10:30",
        location: "Kazanchis, Addis Ababa",
        notes: "Burn wound dressing — requires sterile technique",
        estimatedEarnings: 500,
        distance: "0.9 km",
        status: "pending",
        createdAt: "2026-08-25T06:55:00",
      },
    ];
  }
}
