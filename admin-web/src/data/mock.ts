export type ServiceCategory = {
  id: string;
  name: string;
  icon: string;
  description: string;
  providerCount: number;
  priceFrom: number;
  color: string;
};

export type Provider = {
  id: string;
  name: string;
  title: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  experience: number;
  distance: string;
  services: string[];
  available: boolean;
  verified: boolean;
  bio: string;
  languages: string[];
  serviceArea: string;
  pricePerVisit: number;
  qualifications: string[];
  joinedDate: string;
  completedServices: number;
  status: "verified" | "pending" | "rejected" | "suspended";
};

export type Patient = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email: string;
  dob: string;
  bloodType: string;
  location: string;
  memberSince: string;
  totalAppointments: number;
  status: "active" | "suspended";
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  service: string;
  date: string;
  time: string;
  location: string;
  status: AppointmentStatus;
  paymentStatus: "paid" | "pending" | "failed" | "refunded";
  amount: number;
  notes?: string;
  duration: string;
};

export type AppointmentStatus =
  | "pending"
  | "searching"
  | "accepted"
  | "scheduled"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected";

export type ServiceRequest = {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar: string;
  service: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  estimatedEarnings: number;
  distance: string;
  status: AppointmentStatus;
  createdAt: string;
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
};

export type Conversation = {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
};

export type Transaction = {
  id: string;
  patientName: string;
  providerName: string;
  service: string;
  amount: number;
  method: string;
  status: "successful" | "pending" | "failed" | "refunded" | "cancelled";
  date: string;
};

export type Complaint = {
  id: string;
  userName: string;
  userRole: "patient" | "provider";
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "under_review" | "resolved" | "closed";
  subject: string;
  createdAt: string;
  assignedAdmin?: string;
};

export type Review = {
  id: string;
  reviewerName: string;
  providerName: string;
  rating: number;
  comment: string;
  service: string;
  date: string;
  status: "published" | "hidden" | "flagged";
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  status: "success" | "warning" | "error";
};

// ─── SERVICE CATEGORIES ────────────────────────────────────────────────────────
export const serviceCategories: ServiceCategory[] = [
  { id: "home-nursing", name: "Home Nursing", icon: "🏥", description: "Professional nursing care at home", providerCount: 34, priceFrom: 800, color: "#e6f5f2" },
  { id: "doctor-visit", name: "Doctor Visit", icon: "👨‍⚕️", description: "Physician consultations at your location", providerCount: 21, priceFrom: 1200, color: "#e8f1fb" },
  { id: "physiotherapy", name: "Physiotherapy", icon: "🦿", description: "Rehabilitation and physical therapy", providerCount: 18, priceFrom: 600, color: "#fef3c7" },
  { id: "elderly-care", name: "Elderly Care", icon: "🧓", description: "Compassionate care for older adults", providerCount: 15, priceFrom: 700, color: "#fce7f3" },
  { id: "maternal-care", name: "Maternal Care", icon: "🤱", description: "Prenatal and postnatal support", providerCount: 12, priceFrom: 900, color: "#f5e6ff" },
  { id: "child-care", name: "Child Care", icon: "👶", description: "Pediatric care and support", providerCount: 16, priceFrom: 750, color: "#dcfce7" },
  { id: "wound-care", name: "Wound Care", icon: "🩹", description: "Professional wound dressing and care", providerCount: 22, priceFrom: 500, color: "#fee2e2" },
  { id: "medication", name: "Medication Assist", icon: "💊", description: "Medication administration and management", providerCount: 28, priceFrom: 400, color: "#e0f2fe" },
  { id: "lab-services", name: "Lab Services", icon: "🧪", description: "Home specimen collection", providerCount: 9, priceFrom: 350, color: "#f0fdf4" },
  { id: "telemedicine", name: "Telemedicine", icon: "📱", description: "Remote consultations with specialists", providerCount: 45, priceFrom: 300, color: "#ede9fe" },
];

// ─── PROVIDERS ─────────────────────────────────────────────────────────────────
export const providers: Provider[] = [
  {
    id: "p1",
    name: "Dr. Meron Alemu",
    title: "General Practitioner",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format",
    rating: 4.9,
    reviewCount: 127,
    experience: 8,
    distance: "1.2 km",
    services: ["Doctor Visit", "Telemedicine", "Wound Care"],
    available: true,
    verified: true,
    bio: "Board-certified general practitioner with 8 years of experience in home healthcare. Trained at Black Lion Hospital with special interest in geriatric and family medicine.",
    languages: ["Amharic", "English"],
    serviceArea: "Bole, Kazanchis, Sarbet",
    pricePerVisit: 1200,
    qualifications: ["MD – Addis Ababa University", "Member, Ethiopian Medical Association"],
    joinedDate: "2022-03-15",
    completedServices: 312,
    status: "verified",
  },
  {
    id: "p2",
    name: "Hiwot Girma",
    title: "Registered Nurse",
    avatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop&auto=format",
    rating: 4.8,
    reviewCount: 89,
    experience: 5,
    distance: "0.8 km",
    services: ["Home Nursing", "Medication Assist", "Wound Care"],
    available: true,
    verified: true,
    bio: "Compassionate registered nurse specializing in home-based nursing care. Experienced in post-operative care, chronic disease management, and elderly support.",
    languages: ["Amharic", "English", "Oromiffa"],
    serviceArea: "Megenagna, Ayat, Summit",
    pricePerVisit: 800,
    qualifications: ["BSc Nursing – Jimma University", "Licensed – Ethiopian Nursing Council"],
    joinedDate: "2022-07-20",
    completedServices: 218,
    status: "verified",
  },
  {
    id: "p3",
    name: "Yonas Tekeste",
    title: "Physiotherapist",
    avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&auto=format",
    rating: 4.7,
    reviewCount: 54,
    experience: 6,
    distance: "2.1 km",
    services: ["Physiotherapy", "Elderly Care"],
    available: false,
    verified: true,
    bio: "Certified physiotherapist with extensive experience in musculoskeletal rehabilitation and neurological conditions. Home visits designed to restore mobility and function.",
    languages: ["Amharic", "English", "Tigrinya"],
    serviceArea: "Piazza, 4 Kilo, Arat Kilo",
    pricePerVisit: 600,
    qualifications: ["BSc Physiotherapy – Gondar University", "Certified Manual Therapist"],
    joinedDate: "2021-11-08",
    completedServices: 174,
    status: "verified",
  },
  {
    id: "p4",
    name: "Selamawit Dagnew",
    title: "Maternal Care Nurse",
    avatar: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=200&h=200&fit=crop&auto=format",
    rating: 4.9,
    reviewCount: 63,
    experience: 7,
    distance: "1.5 km",
    services: ["Maternal Care", "Child Care", "Home Nursing"],
    available: true,
    verified: true,
    bio: "Specialized midwife and maternal health nurse with expertise in prenatal care, safe delivery support, and postnatal recovery. Passionate about family wellbeing.",
    languages: ["Amharic", "English"],
    serviceArea: "CMC, Bole Atlas, Gerji",
    pricePerVisit: 900,
    qualifications: ["BSc Midwifery – Hawassa University", "Trained Lactation Consultant"],
    joinedDate: "2023-01-10",
    completedServices: 95,
    status: "verified",
  },
  {
    id: "p5",
    name: "Bereket Haile",
    title: "Medical Laboratory Technician",
    avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format",
    rating: 4.6,
    reviewCount: 41,
    experience: 4,
    distance: "3.0 km",
    services: ["Lab Services", "Medication Assist"],
    available: true,
    verified: true,
    bio: "Licensed laboratory technician offering convenient home specimen collection and testing coordination. Affiliated with accredited labs in Addis Ababa.",
    languages: ["Amharic", "English"],
    serviceArea: "Sarbet, Mekanisa, Gofa",
    pricePerVisit: 350,
    qualifications: ["BSc Medical Lab – Adama University", "Licensed – Ethiopian Lab Council"],
    joinedDate: "2023-06-01",
    completedServices: 67,
    status: "verified",
  },
];

// ─── PATIENTS ──────────────────────────────────────────────────────────────────
export const patients: Patient[] = [
  { id: "u1", name: "Tigist Bekele", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&auto=format", phone: "+251 91 234 5678", email: "tigist.bekele@email.com", dob: "1990-04-12", bloodType: "A+", location: "Bole, Addis Ababa", memberSince: "2023-02-10", totalAppointments: 8, status: "active" },
  { id: "u2", name: "Dawit Haile", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format", phone: "+251 92 876 5432", email: "dawit.haile@email.com", dob: "1985-11-20", bloodType: "O+", location: "Kazanchis, Addis Ababa", memberSince: "2022-11-05", totalAppointments: 14, status: "active" },
  { id: "u3", name: "Selamawit Tadesse", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&auto=format", phone: "+251 93 456 7890", email: "selam.tadesse@email.com", dob: "1998-07-30", bloodType: "B-", location: "Megenagna, Addis Ababa", memberSince: "2024-01-15", totalAppointments: 3, status: "active" },
  { id: "u4", name: "Bereket Mengistu", avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&auto=format", phone: "+251 91 111 2233", email: "bereket.m@email.com", dob: "1975-02-08", bloodType: "AB+", location: "Sarbet, Addis Ababa", memberSince: "2022-08-22", totalAppointments: 21, status: "suspended" },
  { id: "u5", name: "Frehiwot Solomon", avatar: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=200&h=200&fit=crop&auto=format", phone: "+251 94 567 8901", email: "frehiwot.s@email.com", dob: "2001-09-17", bloodType: "O-", location: "Piazza, Addis Ababa", memberSince: "2024-03-01", totalAppointments: 1, status: "active" },
];

// ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
export const appointments: Appointment[] = [
  {
    id: "apt1",
    patientId: "u1",
    patientName: "Tigist Bekele",
    providerId: "p1",
    providerName: "Dr. Meron Alemu",
    providerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format",
    service: "Doctor Home Visit",
    date: "2026-08-26",
    time: "10:00",
    location: "Bole, Addis Ababa",
    status: "scheduled",
    paymentStatus: "paid",
    amount: 1200,
    notes: "Routine check-up, blood pressure monitoring",
    duration: "45 min",
  },
  {
    id: "apt2",
    patientId: "u1",
    patientName: "Tigist Bekele",
    providerId: "p2",
    providerName: "Hiwot Girma",
    providerAvatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop&auto=format",
    service: "Home Nursing",
    date: "2026-08-28",
    time: "14:00",
    location: "Bole, Addis Ababa",
    status: "pending",
    paymentStatus: "pending",
    amount: 800,
    duration: "60 min",
  },
  {
    id: "apt3",
    patientId: "u2",
    patientName: "Dawit Haile",
    providerId: "p3",
    providerName: "Yonas Tekeste",
    providerAvatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&auto=format",
    service: "Physiotherapy",
    date: "2026-08-20",
    time: "09:30",
    location: "Kazanchis, Addis Ababa",
    status: "completed",
    paymentStatus: "paid",
    amount: 600,
    duration: "60 min",
  },
  {
    id: "apt4",
    patientId: "u3",
    patientName: "Selamawit Tadesse",
    providerId: "p1",
    providerName: "Dr. Meron Alemu",
    providerAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format",
    service: "Doctor Home Visit",
    date: "2026-08-15",
    time: "11:00",
    location: "Megenagna, Addis Ababa",
    status: "cancelled",
    paymentStatus: "refunded",
    amount: 1200,
    duration: "45 min",
  },
  {
    id: "apt5",
    patientId: "u4",
    patientName: "Bereket Mengistu",
    providerId: "p4",
    providerName: "Selamawit Dagnew",
    providerAvatar: "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=200&h=200&fit=crop&auto=format",
    service: "Maternal Care",
    date: "2026-08-27",
    time: "08:00",
    location: "Sarbet, Addis Ababa",
    status: "accepted",
    paymentStatus: "paid",
    amount: 900,
    duration: "90 min",
  },
];

// ─── REQUESTS (for provider) ───────────────────────────────────────────────────
export const serviceRequests: ServiceRequest[] = [
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

// ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
export const conversations: Conversation[] = [
  {
    id: "conv1",
    participantId: "p1",
    participantName: "Dr. Meron Alemu",
    participantAvatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&auto=format",
    lastMessage: "I will arrive at 10:00 AM as scheduled.",
    lastMessageTime: "09:45",
    unreadCount: 1,
    messages: [
      { id: "m1", senderId: "p1", text: "Good morning! I have confirmed your appointment for tomorrow.", timestamp: "2026-08-24T08:00:00", read: true },
      { id: "m2", senderId: "u1", text: "Thank you, Doctor. Should I prepare anything?", timestamp: "2026-08-24T08:10:00", read: true },
      { id: "m3", senderId: "p1", text: "Please have a list of any medications you are currently taking.", timestamp: "2026-08-24T08:15:00", read: true },
      { id: "m4", senderId: "p1", text: "I will arrive at 10:00 AM as scheduled.", timestamp: "2026-08-25T09:45:00", read: false },
    ],
  },
  {
    id: "conv2",
    participantId: "p2",
    participantName: "Hiwot Girma",
    participantAvatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=200&h=200&fit=crop&auto=format",
    lastMessage: "Your request has been received. I will confirm soon.",
    lastMessageTime: "Yesterday",
    unreadCount: 0,
    messages: [
      { id: "m5", senderId: "u1", text: "Hello, I submitted a request for home nursing on August 28.", timestamp: "2026-08-24T14:00:00", read: true },
      { id: "m6", senderId: "p2", text: "Your request has been received. I will confirm soon.", timestamp: "2026-08-24T14:30:00", read: true },
    ],
  },
];

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────────
export const transactions: Transaction[] = [
  { id: "txn001", patientName: "Tigist Bekele", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "Telebirr", status: "successful", date: "2026-08-25" },
  { id: "txn002", patientName: "Selamawit Tadesse", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "refunded", date: "2026-08-15" },
  { id: "txn003", patientName: "Dawit Haile", providerName: "Yonas Tekeste", service: "Physiotherapy", amount: 600, method: "Cash", status: "successful", date: "2026-08-20" },
  { id: "txn004", patientName: "Bereket Mengistu", providerName: "Selamawit Dagnew", service: "Maternal Care", amount: 900, method: "Telebirr", status: "successful", date: "2026-08-24" },
  { id: "txn005", patientName: "Frehiwot Solomon", providerName: "Bereket Haile", service: "Lab Services", amount: 350, method: "Awash Bank", status: "pending", date: "2026-08-25" },
  { id: "txn006", patientName: "Dawit Haile", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "successful", date: "2026-08-22" },
  { id: "txn007", patientName: "Tigist Bekele", providerName: "Hiwot Girma", service: "Home Nursing", amount: 800, method: "Telebirr", status: "pending", date: "2026-08-25" },
  { id: "txn008", patientName: "Bereket Mengistu", providerName: "Dr. Meron Alemu", service: "Doctor Home Visit", amount: 1200, method: "CBE Birr", status: "failed", date: "2026-08-18" },
];

// ─── COMPLAINTS ────────────────────────────────────────────────────────────────
export const complaints: Complaint[] = [
  { id: "cmp001", userName: "Dawit Haile", userRole: "patient", category: "Provider conduct", priority: "high", status: "under_review", subject: "Provider arrived 2 hours late without notice", createdAt: "2026-08-23", assignedAdmin: "Admin Kebede" },
  { id: "cmp002", userName: "Tigist Bekele", userRole: "patient", category: "Payment issue", priority: "medium", status: "open", subject: "Payment deducted but service was not confirmed", createdAt: "2026-08-24" },
  { id: "cmp003", userName: "Hiwot Girma", userRole: "provider", category: "Platform issue", priority: "low", status: "resolved", subject: "Unable to update availability calendar", createdAt: "2026-08-20", assignedAdmin: "Admin Tigist" },
  { id: "cmp004", userName: "Frehiwot Solomon", userRole: "patient", category: "Safety concern", priority: "urgent", status: "under_review", subject: "Provider did not follow proper hygiene protocol", createdAt: "2026-08-25", assignedAdmin: "Admin Kebede" },
];

// ─── REVIEWS ───────────────────────────────────────────────────────────────────
export const reviews: Review[] = [
  { id: "rev001", reviewerName: "Tigist Bekele", providerName: "Dr. Meron Alemu", rating: 5, comment: "Excellent care. Dr. Meron was professional, punctual, and very thorough.", service: "Doctor Home Visit", date: "2026-08-20", status: "published" },
  { id: "rev002", reviewerName: "Dawit Haile", providerName: "Yonas Tekeste", rating: 4, comment: "Good session, very helpful exercises. Could improve on timing.", service: "Physiotherapy", date: "2026-08-21", status: "published" },
  { id: "rev003", reviewerName: "Bereket Mengistu", providerName: "Selamawit Dagnew", rating: 5, comment: "Incredibly caring and knowledgeable. Highly recommend for maternal care.", service: "Maternal Care", date: "2026-08-24", status: "published" },
  { id: "rev004", reviewerName: "Frehiwot Solomon", providerName: "Bereket Haile", rating: 2, comment: "Collection process was delayed and results took too long.", service: "Lab Services", date: "2026-08-22", status: "flagged" },
];

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────────
export const auditLogs: AuditLog[] = [
  { id: "log001", actor: "Admin Kebede", action: "Provider verified", resource: "Dr. Meron Alemu", timestamp: "2026-08-25T09:10:00", status: "success" },
  { id: "log002", actor: "Admin Tigist", action: "User suspended", resource: "Bereket Mengistu", timestamp: "2026-08-25T08:45:00", status: "warning" },
  { id: "log003", actor: "System", action: "Payment processed", resource: "TXN-001", timestamp: "2026-08-25T08:00:00", status: "success" },
  { id: "log004", actor: "Admin Kebede", action: "Complaint resolved", resource: "CMP-003", timestamp: "2026-08-24T16:30:00", status: "success" },
  { id: "log005", actor: "Admin Tigist", action: "Service created", resource: "Elderly Care Premium", timestamp: "2026-08-24T14:00:00", status: "success" },
  { id: "log006", actor: "System", action: "Payment failed", resource: "TXN-008", timestamp: "2026-08-18T10:22:00", status: "error" },
];

// ─── CHART DATA ────────────────────────────────────────────────────────────────
export const weeklyRequestsData = [
  { day: "Mon", requests: 18, completed: 14 },
  { day: "Tue", requests: 24, completed: 20 },
  { day: "Wed", requests: 21, completed: 17 },
  { day: "Thu", requests: 30, completed: 25 },
  { day: "Fri", requests: 27, completed: 22 },
  { day: "Sat", requests: 15, completed: 13 },
  { day: "Sun", requests: 10, completed: 9 },
];

export const revenueData = [
  { month: "Mar", revenue: 48200 },
  { month: "Apr", revenue: 56800 },
  { month: "May", revenue: 72400 },
  { month: "Jun", revenue: 68100 },
  { month: "Jul", revenue: 89300 },
  { month: "Aug", revenue: 94700 },
];

export const serviceDistribution = [
  { name: "Home Nursing", value: 28 },
  { name: "Doctor Visit", value: 22 },
  { name: "Physiotherapy", value: 16 },
  { name: "Telemedicine", value: 18 },
  { name: "Other", value: 16 },
];

export const providerEarningsData = [
  { day: "Mon", earnings: 2400 },
  { day: "Tue", earnings: 3200 },
  { day: "Wed", earnings: 1800 },
  { day: "Thu", earnings: 4100 },
  { day: "Fri", earnings: 3600 },
  { day: "Sat", earnings: 2100 },
  { day: "Sun", earnings: 1400 },
];
