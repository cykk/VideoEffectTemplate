import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export interface ReplicateWebhookVerificationResult {
  valid: boolean;
  reason?: string;
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function isLikelyBase64(value: string): boolean {
  if (!value || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

function buildCandidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = [];
  const seen = new Set<string>();

  const add = (buf: Buffer) => {
    if (!buf || buf.length === 0) return;
    const key = buf.toString("hex");
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(buf);
  };

  add(Buffer.from(secret));

  if (secret.startsWith("whsec_")) {
    const stripped = secret.slice("whsec_".length);
    add(Buffer.from(stripped));
    if (isLikelyBase64(stripped)) {
      add(Buffer.from(stripped, "base64"));
    }
  } else if (isLikelyBase64(secret)) {
    add(Buffer.from(secret, "base64"));
  }

  return keys;
}

export function verifyReplicateWebhookSignature(
  headers: Headers,
  body: string,
  secret: string
): ReplicateWebhookVerificationResult {
  const webhookId = headers.get("webhook-id");
  const webhookTimestamp = headers.get("webhook-timestamp");
  const webhookSignature = headers.get("webhook-signature");

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { valid: false, reason: "missing_headers" };
  }

  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp_out_of_range" };
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const candidateKeys = buildCandidateKeys(secret);

  const signatureParts = webhookSignature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of signatureParts) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) {
      continue;
    }

    for (const key of candidateKeys) {
      const expectedSignature = createHmac("sha256", key)
        .update(signedContent)
        .digest("base64");
      if (safeCompare(signature, expectedSignature)) {
        return { valid: true };
      }
    }
  }

  return { valid: false, reason: "signature_mismatch" };
}
