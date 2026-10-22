/**
 * 草稿：登录、支付都会整页跳转，内存里的状态会丢。
 * 照片提交到 R2 临时区后，只保存签名令牌（约 54 字符），同时写入 localStorage 和回跳 URL，
 * 这样即使用户在另一个浏览器里点击邮件登录链接，也能恢复照片。
 */

const DRAFT_KEY = "raindance-draft";
const TOKEN_PARAM = "rd";
const GO_PARAM = "go";
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{12,100}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{21}\.[0-9a-z]{6,12}\.[A-Za-z0-9_-]{22}$/;

export type Draft = {
  tokens: [string | null, string | null];
  requestKey: string | null;
  jobId: string | null;
};

export function createRequestKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export function isTokenFresh(token: string | null): token is string {
  if (!token || !TOKEN_PATTERN.test(token)) return false;
  const expiresAt = Number.parseInt(token.split(".")[1], 36);
  // 留 2 分钟余量，避免恢复后马上过期
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > 2 * 60 * 1000;
}

export function emptyDraft(): Draft {
  return { tokens: [null, null], requestKey: null, jobId: null };
}

export function readDraft(): Draft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null") as Partial<Draft> | null;
    if (!parsed) return emptyDraft();
    const tokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];
    return {
      tokens: [isTokenFresh(tokens[0] ?? null) ? tokens[0]! : null, isTokenFresh(tokens[1] ?? null) ? tokens[1]! : null],
      requestKey: typeof parsed.requestKey === "string" && REQUEST_KEY_PATTERN.test(parsed.requestKey) ? parsed.requestKey : null,
      jobId: typeof parsed.jobId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(parsed.jobId) ? parsed.jobId : null,
    };
  } catch {
    return emptyDraft();
  }
}

export function writeDraft(draft: Draft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 隐私模式或存储已满时忽略，回跳 URL 里仍带有令牌
  }
}

/** 读取回跳 URL 中的恢复参数：两张照片令牌和「自动继续」标记。 */
export function readResumeParams(): {
  tokens: [string | null, string | null];
  autoStart: boolean;
  fromPayment: boolean;
} | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const tokens = params.getAll(TOKEN_PARAM).filter(isTokenFresh).slice(0, 2);
  const autoStart = params.get(GO_PARAM) === "1";
  if (tokens.length === 0 && !autoStart) return null;
  return {
    tokens: [tokens[0] ?? null, tokens[1] ?? null],
    autoStart,
    fromPayment: params.get("payment") === "success" && params.get("payment_type") === "credits",
  };
}

/** 读完后清理地址栏里的恢复参数，保留支付等其他参数。 */
export function stripResumeParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(TOKEN_PARAM) && !url.searchParams.has(GO_PARAM)) return;
  url.searchParams.delete(TOKEN_PARAM);
  url.searchParams.delete(GO_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** 登录或支付完成后回到首页的地址，带着照片令牌并要求自动继续。 */
export function buildResumePath(tokens: string[]): string {
  const params = new URLSearchParams();
  for (const token of tokens) params.append(TOKEN_PARAM, token);
  params.set(GO_PARAM, "1");
  return `/?${params.toString()}`;
}
