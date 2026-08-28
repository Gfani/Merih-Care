import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
// Hash the environment secret key to secure 32-byte length requirement for AES-256
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.ENCRYPTION_KEY || "merihcare-fallback-encryption-key-1234567")
  .digest();

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return text;
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift() || "", "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText).toString("utf8");
    decrypted += decipher.final().toString("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[Encrypted data]";
  }
}
