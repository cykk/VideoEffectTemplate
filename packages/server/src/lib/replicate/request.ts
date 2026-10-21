import { requireEnv } from "@markless/shared/src/lib/config/env";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export interface ReplicateRequestError extends Error {
  status?: number;
  retryAfter?: number;
}

export interface ReplicateRequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  logPrefix?: string;
}

function getReplicateToken(): string {
  return requireEnv("REPLICATE_API_TOKEN");
}

function parseRetryAfter(response: Response, errorText: string): number | undefined {
  const headerRetry = response.headers.get("retry-after");
  if (headerRetry) {
    const parsed = Number(headerRetry);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  try {
    const parsed = JSON.parse(errorText) as { retry_after?: number };
    if (typeof parsed.retry_after === "number") {
      return parsed.retry_after;
    }
  } catch {
    // ignore JSON parse errors
  }

  return undefined;
}

function normalizeRetryAfter(value?: number): number {
  if (!Number.isFinite(value) || value === undefined) return 2;
  return Math.min(Math.max(value, 1), 20);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestReplicatePrediction<T>(
  body: Record<string, unknown>,
  options: ReplicateRequestOptions = {}
): Promise<T> {
  const token = getReplicateToken();
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxRetries = options.maxRetries ?? 0;
  let attempt = 0;

  while (true) {
    const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const errorText = await response.text();
    const retryAfter = response.status === 429 ? parseRetryAfter(response, errorText) : undefined;
    const error = new Error(
      `Replicate prediction failed (${response.status}): ${errorText}`
    ) as ReplicateRequestError;
    error.status = response.status;
    if (retryAfter !== undefined) {
      error.retryAfter = retryAfter;
    }

    if (response.status === 429 && attempt < maxRetries) {
      const waitSeconds = normalizeRetryAfter(retryAfter);
      if (options.logPrefix) {
        console.warn(
          `${options.logPrefix} Rate limited, retrying in ${waitSeconds}s (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
      }
      await wait(waitSeconds * 1000);
      attempt += 1;
      continue;
    }

    if (options.logPrefix) {
      console.error(`${options.logPrefix} Request failed:`, response.status, errorText);
    }
    throw error;
  }
}

export async function getReplicatePrediction<T>(id: string): Promise<T> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid prediction ID');
  const response = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${getReplicateToken()}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Replicate prediction lookup failed (${response.status})`);
  return response.json() as Promise<T>;
}
