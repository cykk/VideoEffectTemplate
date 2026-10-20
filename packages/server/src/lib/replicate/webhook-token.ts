import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@markless/shared/src/lib/config/env";

const TOKEN_VERSION = "v1";
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 60;

export interface WatermarkWebhookTokenPayload {
  userId: string;
  exp: number;
  iat: number;
}

export interface WatermarkWebhookTokenVerification {
  valid: boolean;
  payload?: WatermarkWebhookTokenPayload;
  reason?: string;
}

function getTokenSecret(): string | undefined {
  return (
    getEnv("WATERMARK_WEBHOOK_TOKEN_SECRET") ||
    getEnv("REPLICATE_WEBHOOK_SECRET") ||
    undefined
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function createWatermarkWebhookToken(
  userId: string,
  ttlSeconds: number = DEFAULT_TOKEN_TTL_SECONDS
): string {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error("Missing watermark webhook token secret");
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload: WatermarkWebhookTokenPayload = { userId, iat, exp };
  const payloadBase64 = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}.${payloadBase64}`)
    .digest("base64url");

  return `${TOKEN_VERSION}.${payloadBase64}.${signature}`;
}

export function verifyWatermarkWebhookToken(
  token: string | null
): WatermarkWebhookTokenVerification {
  if (!token) {
    return { valid: false, reason: "missing_token" };
  }

  const secret = getTokenSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }

  const [version, payloadBase64, signature] = token.split(".");
  if (!version || !payloadBase64 || !signature) {
    return { valid: false, reason: "invalid_format" };
  }

  if (version !== TOKEN_VERSION) {
    return { valid: false, reason: "invalid_version" };
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}.${payloadBase64}`)
    .digest("base64url");

  if (!safeCompare(signature, expectedSignature)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  let payload: WatermarkWebhookTokenPayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64)) as WatermarkWebhookTokenPayload;
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  if (!payload.userId || !payload.exp || !payload.iat) {
    return { valid: false, reason: "missing_fields" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}
