/**
 * Phone Number Validation and Normalization Utility
 * Supports Ethiopian domestic formats (09..., 07...), country code formats (+2519..., +2517...),
 * and standard international E.164 formats.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

export function validatePhoneNumber(rawPhone?: string | null): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== "string" || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: "",
      error: "Phone number is required.",
    };
  }

  const trimmed = rawPhone.trim();
  // Strip spaces, dashes, parentheses, dots
  const clean = trimmed.replace(/[\s\-\(\)\.]/g, "");

  // Ethiopian mobile prefix patterns:
  // Domestic 10-digit: 09XXXXXXXX (Ethio Telecom) or 07XXXXXXXX (Safaricom)
  const ethiopianDomesticRegex = /^0(9\d{8}|7\d{8})$/;
  if (ethiopianDomesticRegex.test(clean)) {
    return {
      isValid: true,
      normalized: clean,
    };
  }

  // Ethiopian 9-digit without leading 0: 9XXXXXXXX or 7XXXXXXXX
  const ethiopian9DigitRegex = /^(9\d{8}|7\d{8})$/;
  if (ethiopian9DigitRegex.test(clean)) {
    return {
      isValid: true,
      normalized: "0" + clean,
    };
  }

  // Ethiopian with +251: +2519XXXXXXXX or +2517XXXXXXXX
  const ethiopianE164Regex = /^\+251(9\d{8}|7\d{8})$/;
  if (ethiopianE164Regex.test(clean)) {
    return {
      isValid: true,
      normalized: "0" + clean.substring(4),
    };
  }

  // Ethiopian with 251 (no plus): 2519XXXXXXXX or 2517XXXXXXXX
  const ethiopian251Regex = /^251(9\d{8}|7\d{8})$/;
  if (ethiopian251Regex.test(clean)) {
    return {
      isValid: true,
      normalized: "0" + clean.substring(3),
    };
  }

  // Ethiopian with 00251: 002519XXXXXXXX or 002517XXXXXXXX
  const ethiopian00251Regex = /^00251(9\d{8}|7\d{8})$/;
  if (ethiopian00251Regex.test(clean)) {
    return {
      isValid: true,
      normalized: "0" + clean.substring(5),
    };
  }

  // Standard International E.164: + followed by 8 to 15 digits
  const generalE164Regex = /^\+[1-9]\d{7,14}$/;
  if (generalE164Regex.test(clean)) {
    return {
      isValid: true,
      normalized: clean,
    };
  }

  return {
    isValid: false,
    normalized: "",
    error: "Please enter a valid phone number.",
  };
}
