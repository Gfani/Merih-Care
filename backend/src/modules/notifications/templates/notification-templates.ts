export interface NotificationTemplate {
  title: string;
  smsBody: string;
  pushBody: string;
  emailSubject: string;
  emailHtml: string;
}

export const NOTIFICATION_TEMPLATES: Record<string, (vars: Record<string, any>) => NotificationTemplate> = {
  appointment_scheduled: (vars) => ({
    title: "Appointment Confirmed",
    pushBody: `Your ${vars.service || "healthcare"} visit with ${vars.providerName || "your provider"} is scheduled for ${vars.date} at ${vars.time}.`,
    smsBody: `Merihcare: Your appointment for ${vars.service} with ${vars.providerName} is confirmed for ${vars.date} at ${vars.time}. Ref: ${vars.appointmentId}`,
    emailSubject: `Merihcare - Appointment Confirmation (#${vars.appointmentId})`,
    emailHtml: `<h2>Appointment Confirmed</h2><p>Dear ${vars.patientName || "Patient"},</p><p>Your appointment for <strong>${vars.service}</strong> with <strong>${vars.providerName}</strong> is confirmed for <strong>${vars.date} at ${vars.time}</strong>.</p><p>Location: ${vars.location || "Home Visit"}</p>`,
  }),

  appointment_reminder: (vars) => ({
    title: "Upcoming Appointment Reminder",
    pushBody: `Reminder: You have a ${vars.service || "visit"} scheduled today at ${vars.time}.`,
    smsBody: `Merihcare Reminder: Your visit for ${vars.service} is scheduled for today at ${vars.time}. Please ensure you are available at ${vars.location}.`,
    emailSubject: `Merihcare - Reminder: Upcoming Appointment Today`,
    emailHtml: `<h2>Upcoming Appointment Reminder</h2><p>Dear ${vars.patientName || "Patient"},</p><p>This is a friendly reminder that your appointment for <strong>${vars.service}</strong> is scheduled for today at <strong>${vars.time}</strong>.</p>`,
  }),

  provider_arrived: (vars) => ({
    title: "Provider Has Arrived",
    pushBody: `${vars.providerName || "Your provider"} has arrived at your location.`,
    smsBody: `Merihcare: ${vars.providerName} has arrived at your location for your ${vars.service} visit.`,
    emailSubject: `Merihcare - Provider Has Arrived`,
    emailHtml: `<h2>Provider Has Arrived</h2><p>${vars.providerName} is now at your doorstep for your healthcare consultation.</p>`,
  }),

  payment_success: (vars) => ({
    title: "Payment Receipt",
    pushBody: `Payment of ${vars.amount} ETB for appointment #${vars.appointmentId} was successful.`,
    smsBody: `Merihcare: Payment of ${vars.amount} ETB received. TxRef: ${vars.txRef}. Thank you!`,
    emailSubject: `Merihcare - Payment Receipt (#${vars.txRef})`,
    emailHtml: `<h2>Payment Received</h2><p>Amount: <strong>${vars.amount} ETB</strong></p><p>Transaction Reference: <strong>${vars.txRef}</strong></p>`,
  }),

  emergency_alert: (vars) => ({
    title: "EMERGENCY DISPATCH ALERT",
    pushBody: `EMERGENCY: Immediate medical response dispatched to ${vars.location}.`,
    smsBody: `MERIHCARE EMERGENCY: Medical team dispatched to ${vars.location}. Dispatch contact: ${vars.phone || "+251911112233"}`,
    emailSubject: `URGENT: Merihcare Emergency Alert Dispatched`,
    emailHtml: `<h2>Emergency Medical Alert</h2><p>An emergency dispatch was triggered for patient ${vars.patientName} at ${vars.location}.</p>`,
  }),

  password_reset_otp: (vars) => ({
    title: "Password Reset Code",
    pushBody: `Your password reset code is ${vars.otp}. Do not share this code.`,
    smsBody: `Merihcare: Your verification code is ${vars.otp}. Valid for 15 minutes.`,
    emailSubject: `Merihcare - Password Reset Code`,
    emailHtml: `<h2>Password Reset Code</h2><p>Your 6-digit verification code is: <strong>${vars.otp}</strong></p><p>This code expires in 15 minutes.</p>`,
  }),
};
