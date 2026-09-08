export const REPUTABLE_CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
  "merihcare.et",
]);

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getairmail.com",
  "throwawaymail.com",
  "dispostable.com",
  "mytemp.email",
  "dropmail.me",
  "fake.com",
  "dummy.com",
  "example.com",
  "test.com",
]);

export function validateRealEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email address is required." };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "Please enter a valid email format (e.g., doctor@gmail.com)." };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "Invalid email format." };
  }

  const [username, domain] = parts;

  // Check username quality
  if (username.length < 3) {
    return { isValid: false, error: "Email username is too short. Please provide a real email." };
  }

  if (/^(.)\1+$/.test(username)) {
    return { isValid: false, error: "Synthetic repeating usernames (like 'aaa' or 'xxx') are not allowed." };
  }

  const dummyUsernames = ["ssf", "fake", "temp", "dummy", "test", "testing", "asdf", "qwerty"];
  if (dummyUsernames.includes(username)) {
    return { isValid: false, error: "Synthetic or dummy email accounts are not permitted. Please use your real email." };
  }

  // Check domain quality
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { isValid: false, error: "Temporary, disposable, or test email domains are not allowed." };
  }

  const domainParts = domain.split(".");
  const domainName = domainParts[0];
  const tld = domainParts[domainParts.length - 1];

  // Block single/two-letter dummy domain names like f.com, g.com, ab.com
  if (domainName.length < 3) {
    return {
      isValid: false,
      error: `The domain "${domain}" is not a recognized or legitimate email service. Please use Gmail, Yahoo, Outlook, or an institutional email.`,
    };
  }

  if (/^\d+$/.test(domainName)) {
    return { isValid: false, error: "Purely numeric email domain names are not allowed." };
  }

  // Check if reputable consumer domain
  if (REPUTABLE_CONSUMER_DOMAINS.has(domain)) {
    return { isValid: true };
  }

  // Allow recognized institutional, governmental, and medical domains
  const allowedInstitutions = [
    "et",
    "edu",
    "gov",
    "org",
    "health",
    "hospital",
    "care",
    "clinic",
    "ac",
    "med",
  ];

  const hasInstitutionalTld = allowedInstitutions.includes(tld);
  const isEthiopianInstitution =
    domain.endsWith(".edu.et") ||
    domain.endsWith(".gov.et") ||
    domain.endsWith(".org.et") ||
    domain.endsWith(".net.et");

  if (hasInstitutionalTld || isEthiopianInstitution) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: `Please use a recognized email provider (such as Gmail, Yahoo, Outlook, iCloud) or an official healthcare/institutional email address.`,
  };
}
