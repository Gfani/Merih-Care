import { Injectable } from "@nestjs/common";

@Injectable()
export class PaymentsService {
  getTransactions() {
    return [
      { id: "txn001", patientName: "Tigist Bekele", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "Telebirr", status: "successful", date: "2026-08-25" },
      { id: "txn002", patientName: "Selamawit Tadesse", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "refunded", date: "2026-08-15" },
      { id: "txn003", patientName: "Dawit Haile", providerName: "Yonas Tekeste", service: "Physiotherapy", amount: 600, method: "Cash", status: "successful", date: "2026-08-20" },
      { id: "txn004", patientName: "Bereket Mengistu", providerName: "Selamawit Dagnew", service: "Maternal Care", amount: 900, method: "Telebirr", status: "successful", date: "2026-08-24" },
      { id: "txn005", patientName: "Frehiwot Solomon", providerName: "Bereket Haile", service: "Lab Services", amount: 350, method: "Awash Bank", status: "pending", date: "2026-08-25" },
      { id: "txn006", patientName: "Dawit Haile", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "successful", date: "2026-08-22" },
      { id: "txn007", patientName: "Tigist Bekele", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "pending", date: "2026-08-25" },
      { id: "txn008", patientName: "Bereket Mengistu", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "failed", date: "2026-08-18" },
    ];
  }
}
