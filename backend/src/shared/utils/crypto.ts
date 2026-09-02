import * as crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production") {
    if (!key || key.includes("fallback") || key.includes("change_me")) {
      throw new Error("[SECURITY CRITICAL] ENCRYPTION_KEY must be set in production environment. Fallback keys are rejected.");
    }
  }
  return crypto
    .createHash("sha256")
    .update(key || "merihcare-fallback-encryption-key-1234567")
    .digest();
}

export function encrypt(text: string): string {
  if (!text) return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift() || "", "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText).toString("utf8");
    decrypted += decipher.final().toString("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[Encrypted data]";
  }
}
