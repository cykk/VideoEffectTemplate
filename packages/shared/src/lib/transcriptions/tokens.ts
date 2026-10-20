import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { ANONYMOUS_TRANSCRIPTION_RETENTION_SECONDS } from "@markless/shared/src/lib/transcriptions/anonymous-retention";

type TokenKind = "access" | "stream" | "webhook" | "link_preview";

interface SignedTokenPayloadBase {
  kind: TokenKind;
  iat: number;
  exp: number;
}

interface BaseTokenPayload extends SignedTokenPayloadBase {
  kind: "access" | "stream" | "webhook";
  publicId: string;
  anonymousSessionId?: string | null;
}

interface LinkPreviewTokenPayload extends SignedTokenPayloadBase {
  kind: "link_preview";
  requestUrl: string;
  canonicalUrl: string;
  title: string;
  durationMs: number | null;
  sourceType: "audio" | "video";
  status: "resolvable" | "preview_only";
}

interface TokenVerificationResult<TPayload extends SignedTokenPayloadBase> {
  valid: boolean;
  payload?: TPayload;
}

const TOKEN_VERSION = "v1";

function getVerificationSecrets(): string[] {
  const candidates = [
    getEnv("TRANSCRIPTION_TOKEN_SECRET"),
    getEnv("ANON_STREAM_TOKEN_SECRET"),
    getEnv("REPLICATE_WEBHOOK_SECRET"),
    getEnv("BETTER_AUTH_SECRET"),
    "transcription-dev-secret",
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

function getPrimaryTokenSecret(): string {
  return getVerificationSecrets()[0] || "transcription-dev-secret";
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function createToken<TPayload extends Omit<SignedTokenPayloadBase, "iat" | "exp">>(
  payload: TPayload,
  ttlSeconds: number
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const normalizedPayload = {
    ...payload,
    iat,
    exp,
  } as TPayload & SignedTokenPayloadBase;
  const payloadBase64 = encodeBase64Url(JSON.stringify(normalizedPayload));
  const signature = createHmac("sha256", getPrimaryTokenSecret())
    .update(`${TOKEN_VERSION}.${payloadBase64}`)
    .digest("base64url");

  return `${TOKEN_VERSION}.${payloadBase64}.${signature}`;
}

function verifySignedTokenPayload<TPayload extends SignedTokenPayloadBase>(
  token: string | null,
  expectedKind: TokenKind
): TokenVerificationResult<TPayload> {
  if (!token) {
    return { valid: false };
  }

  const [version, payloadBase64, signature] = token.split(".");
  if (!version || !payloadBase64 || !signature || version !== TOKEN_VERSION) {
    return { valid: false };
  }

  const signatureMatched = getVerificationSecrets().some((secret) => {
    const expectedSignature = createHmac("sha256", secret)
      .update(`${TOKEN_VERSION}.${payloadBase64}`)
      .digest("base64url");

    return safeCompare(signature, expectedSignature);
  });

  if (!signatureMatched) {
    return { valid: false };
  }

  let payload: TPayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadBase64)) as TPayload;
  } catch {
    return { valid: false };
  }

  if (!payload || payload.kind !== expectedKind) {
    return { valid: false };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || now > payload.exp) {
    return { valid: false };
  }

  return {
    valid: true,
    payload,
  };
}

function verifyToken(
  token: string | null,
  expectedKind: "access" | "stream" | "webhook"
): TokenVerificationResult<BaseTokenPayload> {
  const result = verifySignedTokenPayload<BaseTokenPayload>(token, expectedKind);
  if (!result.valid || !result.payload?.publicId) {
    return { valid: false };
  }

  return result;
}

export function createAnonymousTranscriptionAccessToken(
  publicId: string,
  anonymousSessionId: string,
  ttlSeconds: number = ANONYMOUS_TRANSCRIPTION_RETENTION_SECONDS
): string {
  return createToken(
    {
      kind: "access",
      publicId,
      anonymousSessionId,
    },
    ttlSeconds
  );
}

export function createAnonymousTranscriptionStreamToken(
  publicId: string,
  anonymousSessionId: string,
  ttlSeconds: number = 5 * 60
): string {
  return createToken(
    {
      kind: "stream",
      publicId,
      anonymousSessionId,
    },
    ttlSeconds
  );
}

export function createTranscriptionStreamToken(
  publicId: string,
  options?: {
    anonymousSessionId?: string | null;
    ttlSeconds?: number;
  }
): string {
  return createToken(
    {
      kind: "stream",
      publicId,
      anonymousSessionId: options?.anonymousSessionId ?? null,
    },
    options?.ttlSeconds ?? 5 * 60
  );
}

export function createTranscriptionWebhookToken(
  publicId: string,
  ttlSeconds: number = 60 * 60
): string {
  return createToken(
    {
      kind: "webhook",
      publicId,
      anonymousSessionId: null,
    },
    ttlSeconds
  );
}

export function createTranscriptionLinkPreviewToken(
  input: {
    requestUrl: string;
    canonicalUrl: string;
    title: string;
    durationMs: number | null;
    sourceType: "audio" | "video";
    status: "resolvable" | "preview_only";
  },
  ttlSeconds: number = 10 * 60
): string {
  return createToken(
    {
      kind: "link_preview",
      requestUrl: input.requestUrl,
      canonicalUrl: input.canonicalUrl,
      title: input.title,
      durationMs: input.durationMs,
      sourceType: input.sourceType,
      status: input.status,
    },
    ttlSeconds
  );
}

export function verifyAnonymousTranscriptionAccessToken(token: string | null) {
  return verifyToken(token, "access");
}

export function verifyAnonymousTranscriptionStreamToken(token: string | null) {
  return verifyToken(token, "stream");
}

export function verifyTranscriptionStreamToken(token: string | null) {
  return verifyToken(token, "stream");
}

export function verifyTranscriptionWebhookToken(token: string | null) {
  return verifyToken(token, "webhook");
}

export function verifyTranscriptionLinkPreviewToken(token: string | null) {
  return verifySignedTokenPayload<LinkPreviewTokenPayload>(token, "link_preview");
}
