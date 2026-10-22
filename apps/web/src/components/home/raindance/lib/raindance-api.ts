import { apiFetch, buildClientApiUrl } from "@markless/shared/src/lib/http/client";

export const RAINDANCE_FEATURE_KEY = "raindance";

export type RaindanceConfig = { available: boolean; credits: number | null };

export type RaindanceJob = {
  id: string;
  status: string;
  credits: number;
  errorCode?: string | null;
  output?: { kind?: string } | null;
};

export type UploadErrorCode = "tooLarge" | "rateLimited" | "invalid" | "unavailable" | "upload";

export class UploadError extends Error {
  constructor(public readonly code: UploadErrorCode) {
    super(code);
  }
}

export type SubmitResult =
  | { ok: true; job: RaindanceJob }
  | { ok: false; reason: "auth" | "credits" | "invalid" | "unavailable" | "network" };

const TERMINAL_STATUSES = ["succeeded", "failed", "canceled"];

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export async function fetchRaindanceConfig(): Promise<RaindanceConfig> {
  try {
    const response = await apiFetch("/api/ai/raindance/config", { cache: "no-store" });
    const payload = await response.json();
    return { available: Boolean(payload?.available), credits: typeof payload?.credits === "number" ? payload.credits : null };
  } catch {
    return { available: false, credits: null };
  }
}

/** 上传压缩后的照片，返回带签名的临时令牌（匿名可用）。 */
export async function uploadPhoto(blob: Blob): Promise<{ token: string; expiresAt: number }> {
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  let response: Response;
  try {
    response = await apiFetch("/api/ai/uploads", { method: "POST", body: form });
  } catch {
    throw new UploadError("upload");
  }
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.ok && typeof payload.token === "string") {
    return { token: payload.token, expiresAt: Number(payload.expiresAt) || 0 };
  }
  if (response.status === 413) throw new UploadError("tooLarge");
  if (response.status === 429) throw new UploadError("rateLimited");
  if (response.status === 400) throw new UploadError("invalid");
  if (response.status === 503) throw new UploadError("unavailable");
  throw new UploadError("upload");
}

export function photoPreviewUrl(token: string): string {
  return buildClientApiUrl(`/api/ai/uploads/preview?token=${encodeURIComponent(token)}`);
}

export function videoDownloadUrl(jobId: string): string {
  return buildClientApiUrl(`/api/ai/jobs/${encodeURIComponent(jobId)}/asset?download=1`);
}

export async function submitRaindanceJob(requestKey: string, tokens: [string, string]): Promise<SubmitResult> {
  try {
    const response = await apiFetch("/api/ai/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestKey, featureKey: RAINDANCE_FEATURE_KEY, images: tokens }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.job) return { ok: true, job: payload.job as RaindanceJob };
    if (response.status === 401) return { ok: false, reason: "auth" };
    if (response.status === 402) return { ok: false, reason: "credits" };
    if (response.status === 400) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function fetchRaindanceJob(id: string): Promise<RaindanceJob | null> {
  try {
    const response = await apiFetch(`/api/ai/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.job as RaindanceJob) ?? null;
  } catch {
    return null;
  }
}

export async function fetchPlaybackUrl(id: string): Promise<string | null> {
  try {
    const response = await apiFetch(`/api/ai/jobs/${encodeURIComponent(id)}/asset?format=json`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return typeof payload?.url === "string" ? payload.url : null;
  } catch {
    return null;
  }
}
