import { Injectable } from "@nestjs/common";

@Injectable()
export class ReportsService {
  getDashboardStats() {
    return {
      weeklyRequestsData: [
        { day: "Mon", requests: 18, completed: 14 },
        { day: "Tue", requests: 24, completed: 20 },
        { day: "Wed", requests: 21, completed: 17 },
        { day: "Thu", requests: 30, completed: 25 },
        { day: "Fri", requests: 27, completed: 22 },
        { day: "Sat", requests: 15, completed: 13 },
        { day: "Sun", requests: 10, completed: 9 },
      ],
      revenueData: [
        { month: "Mar", revenue: 48200 },
        { month: "Apr", revenue: 56800 },
        { month: "May", revenue: 72400 },
        { month: "Jun", revenue: 68100 },
        { month: "Jul", revenue: 89300 },
        { month: "Aug", revenue: 94700 },
      ],
      serviceDistribution: [
        { name: "Home Nursing", value: 28 },
        { name: "Doctor Visit", value: 22 },
        { name: "Physiotherapy", value: 16 },
        { name: "Telemedicine", value: 18 },
        { name: "Other", value: 16 },
      ],
      providerEarningsData: [
        { day: "Mon", earnings: 2400 },
        { day: "Tue", earnings: 3200 },
        { day: "Wed", earnings: 1800 },
        { day: "Thu", earnings: 4100 },
        { day: "Fri", earnings: 3600 },
        { day: "Sat", earnings: 2100 },
        { day: "Sun", earnings: 1400 },
      ]
    };
  }
}
