/**
 * Parse a standard HTTP Cookie header string into key-value pairs.
 * Safe against malformed inputs and percent-encoded values.
 */
export function parseCookieString(cookieHeader?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return cookies;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }

  return cookies;
}

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  maxAge?: number;
  path?: string;
  domain?: string;
}

export function getSecureCookieOptions(isProduction: boolean, maxAgeMs = 7 * 24 * 60 * 60 * 1000): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}
