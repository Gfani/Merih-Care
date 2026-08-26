import * as crypto from "crypto";

// Base32 decoding helper
function base32Decode(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/=+$/, "");
  const length = cleaned.length;
  const buffer = Buffer.alloc(Math.floor((length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

export function generateTOTP(secret: string, timeStep = 30): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Buffer.alloc(8);
  const time = Math.floor(epoch / timeStep);
  counter.writeUInt32BE(0, 0);
  counter.writeUInt32BE(time, 4);

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(counter);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

export function verifyTOTP(token: string, secret: string, timeStep = 30, window = 1): boolean {
  try {
    const epoch = Math.floor(Date.now() / 1000);
    const key = base32Decode(secret);

    for (let i = -window; i <= window; i++) {
      const counter = Buffer.alloc(8);
      const time = Math.floor(epoch / timeStep) + i;
      counter.writeUInt32BE(0, 0);
      counter.writeUInt32BE(time, 4);

      const hmac = crypto.createHmac("sha1", key);
      hmac.update(counter);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const code =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const checkToken = (code % 1000000).toString().padStart(6, "0");
      if (checkToken === token) {
        return true;
      }
    }
  } catch (e) {
    console.error("verifyTOTP failed: ", e);
  }
  return false;
}
