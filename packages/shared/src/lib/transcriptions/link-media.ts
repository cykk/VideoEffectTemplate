import { execFile } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import youtubeDl from "youtube-dl-exec";
import type { Payload, Thumbnail } from "youtube-dl-exec";
import { getEnv } from "@markless/shared/src/lib/config/env";
import type {
  TranscriptionSegment,
  TranscriptionTranscriptSource,
} from "@markless/shared/src/types/transcriptions";

export type LinkPreviewStatus = "resolvable" | "preview_only";
export type LinkPreviewReason =
  | "instagram_media_unavailable"
  | "link_not_public";

export type ResolvedLinkPreview = {
  canonicalUrl: string;
  title: string;
  durationMs: number | null;
  thumbnailUrl: string | null;
  sourceType: "audio" | "video";
  extractor: string | null;
  status: LinkPreviewStatus;
  reason?: LinkPreviewReason;
  message?: string | null;
};

export type ResolvedLinkMedia = ResolvedLinkPreview & {
  directAudioUrl: string;
  contentType: string;
  fileSizeBytes: number | null;
  fileExtension: string;
};

export type DownloadedLinkMedia = {
  preview: ResolvedLinkPreview;
  filePath: string;
  fileName: string;
  fileExtension: string;
  contentType: string;
  fileSizeBytes: number;
  sourceType: "audio" | "video";
  durationMs: number | null;
  title: string;
  alreadyClippedForProcessing: boolean;
};

type YouTubeCaptionTranscriptSource = Extract<
  TranscriptionTranscriptSource,
  "youtube_manual_captions" | "youtube_auto_captions"
>;

export type ResolvedYouTubeCaptionTranscript = {
  language: string | null;
  durationMs: number | null;
  segments: TranscriptionSegment[];
  source: YouTubeCaptionTranscriptSource;
};

type LightweightLinkPreviewPayload = ResolvedLinkPreview & {
  language: string | null;
};

const execFileAsync = promisify(execFile);
const YTDLP_TIMEOUT_MS = 30000;
const YTDLP_DOWNLOAD_TIMEOUT_MS = 180000;
const YTDLP_PREVIEW_TIMEOUT_MS = 60000;
const YTDLP_CAPTION_DOWNLOAD_TIMEOUT_MS = 15000;
const INSTAGRAM_RETRY_ATTEMPTS = 2;
const INSTAGRAM_HEADERS = [
  "referer:https://www.instagram.com/",
  "accept-language:en-US,en;q=0.9",
  "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
];

let cachedYoutubeDlInstance:
  | ((url: string, flags?: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>)
  | null = null;
let cachedYoutubeDlBinaryPath: string | null = null;

function getYtDlpBinaryFileName(): string {
  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

function ensureExecutableBinary(binaryPath: string): string {
  if (process.platform === "win32") {
    return binaryPath;
  }

  try {
    chmodSync(binaryPath, 0o755);
  } catch {
    // Best effort only. Runtime execution will surface a real permission error.
  }

  return binaryPath;
}

function resolveYtDlpBinaryPath(): string {
  if (cachedYoutubeDlBinaryPath) {
    return cachedYoutubeDlBinaryPath;
  }

  const configuredPath = getEnv("YTDLP_BINARY_PATH");
  const binaryFileName = getYtDlpBinaryFileName();
  const candidateBases = new Set<string>();

  if (configuredPath) {
    const directCandidate = configuredPath.trim();
    const normalizedDirect = path.isAbsolute(directCandidate)
      ? directCandidate
      : path.resolve(process.cwd(), directCandidate);
    if (existsSync(normalizedDirect)) {
      cachedYoutubeDlBinaryPath = ensureExecutableBinary(normalizedDirect);
      return cachedYoutubeDlBinaryPath;
    }
  }

  let cursor = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    candidateBases.add(cursor);
    const next = path.dirname(cursor);
    if (next === cursor) {
      break;
    }
    cursor = next;
  }

  const bundledCandidates = [...candidateBases].map((baseDir) =>
    path.join(
      baseDir,
      "tools",
      "yt-dlp",
      process.platform === "win32" ? "win32" : "linux",
      binaryFileName
    )
  );

  for (const candidate of bundledCandidates) {
    if (existsSync(candidate)) {
      cachedYoutubeDlBinaryPath = ensureExecutableBinary(candidate);
      return cachedYoutubeDlBinaryPath;
    }
  }

  throw new Error(
    `yt-dlp binary not found. Checked: ${bundledCandidates.join(" | ")}`
  );
}

function getYoutubeDlInstance() {
  if (cachedYoutubeDlInstance) {
    return cachedYoutubeDlInstance;
  }

  const binaryPath = resolveYtDlpBinaryPath();
  cachedYoutubeDlInstance = youtubeDl.create(binaryPath) as typeof cachedYoutubeDlInstance;
  return cachedYoutubeDlInstance;
}

function isYtDlpTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeTimedOut =
    "killed" in error && Boolean((error as { killed?: unknown }).killed);
  const signal =
    "signal" in error
      ? String((error as { signal?: unknown }).signal ?? "")
      : "signalCode" in error
        ? String((error as { signalCode?: unknown }).signalCode ?? "")
        : "";
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error.message?.toLowerCase() ?? "";

  return (
    maybeTimedOut ||
    signal === "SIGTERM" ||
    code === "ETIMEDOUT" ||
    message.includes("timed out")
  );
}

function normalizeYtDlpError(
  error: unknown,
  operation: string,
  timeoutMs: number = YTDLP_TIMEOUT_MS
): Error {
  if (error instanceof Error) {
    if (isYtDlpTimeoutError(error)) {
      return new Error(
        `yt-dlp ${operation} timed out after ${Math.round(timeoutMs / 1000)}s`,
        { cause: error }
      );
    }

    const message = error.message?.trim();
    if (message) {
      return new Error(`yt-dlp ${operation} failed: ${message}`, { cause: error });
    }

    const details = [
      "code" in error ? String((error as { code?: unknown }).code ?? "") : "",
      "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "",
      "stdout" in error ? String((error as { stdout?: unknown }).stdout ?? "") : "",
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(" | ");

    return new Error(
      `yt-dlp ${operation} failed${details ? `: ${details}` : ""}`,
      { cause: error }
    );
  }

  return new Error(`yt-dlp ${operation} failed`, { cause: error });
}

function normalizeLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isInstagramUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return hostname === "instagram.com" || hostname === "www.instagram.com";
  } catch {
    return false;
  }
}

export function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

function ensureSafePublicUrl(value: string, fieldName: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${fieldName} is invalid`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${fieldName} must use http or https`);
  }

  if (isLocalHost(url.hostname) || isPrivateIpv4(url.hostname)) {
    throw new Error(`${fieldName} host is not allowed`);
  }

  return url;
}

function normalizeDurationMs(durationSeconds: unknown): number | null {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  return Math.round(durationSeconds * 1000);
}

function pickThumbnail(
  thumbnails: Thumbnail[] | undefined,
  fallback: string | undefined
): string | null {
  const sorted = [...(thumbnails ?? [])]
    .filter((item) => typeof item.url === "string" && item.url.trim().length > 0)
    .sort((left, right) => {
      const leftScore = (left.width ?? 0) * (left.height ?? 0);
      const rightScore = (right.width ?? 0) * (right.height ?? 0);
      return rightScore - leftScore;
    });

  const winner = sorted[0]?.url?.trim();
  if (winner) {
    return winner;
  }

  return fallback?.trim() || null;
}

function inferSourceType(payload: Payload): "audio" | "video" {
  if (payload.media_type === "audio") {
    return "audio";
  }

  const hasVideoTrack = payload.formats?.some(
    (format) => format.vcodec && format.vcodec !== "none"
  );

  return hasVideoTrack ? "video" : "audio";
}

function inferAudioContentType(extension: string): string {
  switch (extension.toLowerCase()) {
    case "m4a":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "webm":
      return "audio/webm";
    default:
      return "audio/mpeg";
  }
}

function sanitizeTitle(value: string | undefined): string {
  const normalized = (value || "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, "...")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "Untitled media";
}

function sanitizeExtension(value: string | undefined): string {
  const normalized = (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized || "mp3";
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "transcription";
}

function buildPreviewFromPayload(payload: Payload, fallbackUrl: string): ResolvedLinkPreview {
  const canonicalUrl =
    payload.webpage_url?.trim() ||
    payload.original_url?.trim() ||
    fallbackUrl;

  return {
    canonicalUrl,
    title: sanitizeTitle(payload.title),
    durationMs: normalizeDurationMs(payload.duration),
    thumbnailUrl: pickThumbnail(payload.thumbnails, payload.thumbnail),
    sourceType: inferSourceType(payload),
    extractor: payload.extractor_key || payload.extractor || null,
    status: "resolvable",
    message: null,
  };
}

function buildInstagramYtDlpFlags(): Record<string, unknown> {
  return {
    addHeader: INSTAGRAM_HEADERS,
    impersonate: "chrome:windows-10",
  };
}

function buildInstagramYtDlpCliArgs(): string[] {
  return [
    "--impersonate",
    "chrome:windows-10",
    ...INSTAGRAM_HEADERS.flatMap((header) => ["--add-header", header]),
  ];
}

function getErrorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return "";
  }

  const message = error.message?.trim() ?? "";
  const stderr =
    "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "").trim() : "";
  const stdout =
    "stdout" in error ? String((error as { stdout?: unknown }).stdout ?? "").trim() : "";

  return [message, stderr, stdout].filter(Boolean).join(" | ");
}

function isInstagramEmptyMediaError(error: unknown): boolean {
  const text = getErrorText(error).toLowerCase();
  return text.includes("instagram sent an empty media response");
}

function isInstagramAuthRequiredError(error: unknown): boolean {
  const text = getErrorText(error).toLowerCase();
  return (
    text.includes("cookies-from-browser") ||
    text.includes("use --cookies") ||
    text.includes("authentication") ||
    text.includes("login required") ||
    text.includes("not available") ||
    text.includes("private") ||
    text.includes("requested content is not available")
  );
}

function classifyInstagramPreviewFailure(error: unknown): {
  reason: LinkPreviewReason;
  message: string;
} | null {
  if (isInstagramAuthRequiredError(error)) {
    return {
      reason: "link_not_public",
      message:
        "This Instagram post is not publicly accessible for server-side processing. Upload the video file to continue.",
    };
  }

  if (isInstagramEmptyMediaError(error)) {
    return {
      reason: "instagram_media_unavailable",
      message:
        "This public Instagram post is visible, but direct media extraction isn't available right now. Upload the video file to continue.",
    };
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractMetaContent(html: string, propertyName: string): string | null {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = match?.[1]?.trim();
    if (content) {
      return decodeHtmlEntities(content);
    }
  }

  return null;
}

function extractCanonicalUrl(html: string): string | null {
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );
  const href = match?.[1]?.trim();
  return href ? decodeHtmlEntities(href) : null;
}

async function fetchInstagramHtmlPreview(url: string): Promise<ResolvedLinkPreview | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.instagram.com/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const title = extractMetaContent(html, "og:title");
    const thumbnailUrl = extractMetaContent(html, "og:image");
    const canonicalUrl = extractCanonicalUrl(html) || extractMetaContent(html, "og:url") || url;

    if (!title && !thumbnailUrl) {
      return null;
    }

    return {
      canonicalUrl,
      title: sanitizeTitle(title ?? "Instagram post"),
      durationMs: null,
      thumbnailUrl,
      sourceType: "video",
      extractor: "InstagramHTML",
      status: "preview_only",
      reason: "instagram_media_unavailable",
      message:
        "This public Instagram post is visible, but direct media extraction isn't available right now. Upload the video file to continue.",
    };
  } catch {
    return null;
  }
}

async function runYtDlpCommand(args: string[], timeoutMs: number): Promise<string> {
  const binaryPath = resolveYtDlpBinaryPath();
  const { stdout } = await execFileAsync(binaryPath, args, {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
  });
  return stdout;
}

async function fetchLightweightLinkPreview(url: string): Promise<LightweightLinkPreviewPayload> {
  const baseArgs = [
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificates",
    "--skip-download",
    "--dump-single-json",
    url,
  ];
  const args = isInstagramUrl(url)
    ? [...baseArgs, ...buildInstagramYtDlpCliArgs()]
    : baseArgs;
  const attempts = isInstagramUrl(url) ? INSTAGRAM_RETRY_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const stdout = await runYtDlpCommand(args, YTDLP_PREVIEW_TIMEOUT_MS);
      let payload: Payload;

      try {
        payload = JSON.parse(stdout) as Payload;
      } catch {
        throw new Error("yt-dlp preview resolve returned invalid json");
      }

      if (!payload.title?.trim()) {
        throw new Error("yt-dlp preview resolve returned no title");
      }

      return {
        ...buildPreviewFromPayload(payload, url),
        language: payload.language?.trim() || null,
      };
    } catch (error) {
      lastError = error;
      if (!isInstagramUrl(url) || !isInstagramEmptyMediaError(error)) {
        break;
      }
    }
  }

  throw normalizeYtDlpError(lastError, "preview resolve", YTDLP_PREVIEW_TIMEOUT_MS);
}

function buildPreferredYouTubeSubtitleLanguages(language: string | null): string[] {
  const candidates: string[] = [];
  const normalized = language?.trim() || "";
  const baseLanguage = normalized.includes("-")
    ? normalized.split("-")[0] || normalized
    : normalized;

  for (const candidate of [
    normalized,
    normalized ? `${normalized}-orig` : "",
    baseLanguage,
    baseLanguage ? `${baseLanguage}-orig` : "",
    normalized ? `${normalized}-*` : "",
    baseLanguage ? `${baseLanguage}-*` : "",
  ]) {
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function buildYouTubeSubtitleTempDir(): string {
  return path.join(os.tmpdir(), "transvio", "youtube-captions");
}

function normalizeCaptionText(
  segments: Array<Record<string, unknown>> | undefined
): string {
  return (segments ?? [])
    .map((segment) => {
      const value = segment.utf8;
      return typeof value === "string" ? value : "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYouTubeJson3Transcript(rawValue: string): Omit<
  ResolvedYouTubeCaptionTranscript,
  "language" | "source"
> | null {
  const parsed = JSON.parse(rawValue) as { events?: Array<Record<string, unknown>> };
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  const segments: TranscriptionSegment[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const startMs = Number(event.tStartMs);
    const durationMs = Number(event.dDurationMs);
    const nextStartMs = Number(events[index + 1]?.tStartMs);
    const text = normalizeCaptionText(
      Array.isArray(event.segs) ? (event.segs as Array<Record<string, unknown>>) : undefined
    );

    if (!Number.isFinite(startMs) || startMs < 0 || !text) {
      continue;
    }

    const fallbackEndMs =
      Number.isFinite(nextStartMs) && nextStartMs > startMs
        ? nextStartMs
        : startMs + 1;
    const endMs =
      Number.isFinite(durationMs) && durationMs > 0 ? startMs + durationMs : fallbackEndMs;

    segments.push({
      id: `segment_${segments.length + 1}`,
      speaker: null,
      rawSpeaker: null,
      startMs: Math.round(startMs),
      endMs: Math.max(Math.round(endMs), Math.round(startMs) + 1),
      text,
    });
  }

  if (segments.length === 0) {
    return null;
  }

  return {
    durationMs: Math.max(...segments.map((segment) => segment.endMs)),
    segments,
  };
}

type YouTubeCaptionTrackMap = Record<string, unknown>;

function normalizeYouTubeLanguageTag(language: string | null | undefined): string {
  return (language || "").trim().toLowerCase();
}

function extractYouTubeCaptionTrackMap(
  payload: Payload,
  source: "subtitles" | "automatic_captions"
): YouTubeCaptionTrackMap {
  const rawValue = (payload as Payload & {
    subtitles?: unknown;
    automatic_captions?: unknown;
  })[source];

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  return rawValue as YouTubeCaptionTrackMap;
}

function getAvailableYouTubeCaptionLanguages(trackMap: YouTubeCaptionTrackMap): string[] {
  return Object.keys(trackMap).filter((language) => language.trim().length > 0);
}

function matchPreferredYouTubeCaptionLanguage(
  availableLanguages: string[],
  preferredLanguage: string | null
): string | null {
  if (availableLanguages.length === 0) {
    return null;
  }

  const normalizedByOriginal = new Map(
    availableLanguages.map((language) => [normalizeYouTubeLanguageTag(language), language])
  );
  const preferredCandidates = buildPreferredYouTubeSubtitleLanguages(preferredLanguage).map((value) =>
    normalizeYouTubeLanguageTag(value)
  );

  for (const candidate of preferredCandidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.endsWith("-*")) {
      const prefix = candidate.slice(0, -1);
      const matched = [...normalizedByOriginal.entries()].find(([language]) =>
        language.startsWith(prefix)
      );
      if (matched) {
        return matched[1];
      }
      continue;
    }

    const exactMatch = normalizedByOriginal.get(candidate);
    if (exactMatch) {
      return exactMatch;
    }
  }

  for (const fallback of ["en", "en-us", "en-gb"]) {
    const exactMatch = normalizedByOriginal.get(fallback);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return availableLanguages[0] ?? null;
}

async function downloadYouTubeCaptionTranscript(input: {
  url: string;
  language: string;
  source: YouTubeCaptionTranscriptSource;
}): Promise<ResolvedYouTubeCaptionTranscript | null> {
  const tempDir = path.join(
    buildYouTubeSubtitleTempDir(),
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  await mkdir(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, "subtitle.%(ext)s");

  try {
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--no-check-certificates",
      "--skip-download",
      input.source === "youtube_auto_captions" ? "--write-auto-subs" : "--write-subs",
      "--sub-format",
      "json3",
      "--sub-langs",
      input.language,
      "--output",
      outputTemplate,
      input.url,
    ];

    await runYtDlpCommand(args, YTDLP_CAPTION_DOWNLOAD_TIMEOUT_MS);

    const downloadedFiles = await readdir(tempDir).catch(() => []);
    const subtitleFileName =
      downloadedFiles.find((entry) => entry.endsWith(".json3") && entry.startsWith("subtitle.")) ??
      null;

    if (!subtitleFileName) {
      return null;
    }

    const rawTranscript = await readFile(path.join(tempDir, subtitleFileName), "utf8");
    const transcript = parseYouTubeJson3Transcript(rawTranscript);
    if (!transcript) {
      return null;
    }

    return {
      ...transcript,
      language: input.language,
      source: input.source,
    };
  } catch (error) {
    const operation =
      input.source === "youtube_auto_captions"
        ? "automatic caption resolve"
        : "manual caption resolve";
    throw normalizeYtDlpError(error, operation, YTDLP_CAPTION_DOWNLOAD_TIMEOUT_MS);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function resolveYouTubeCaptionTranscript(
  url: string,
  requestedLanguage?: string | null
): Promise<ResolvedYouTubeCaptionTranscript | null> {
  const normalizedUrl = validateIncomingLink(url);
  if (!isYouTubeUrl(normalizedUrl)) {
    return null;
  }

  const payload = await fetchLinkPayload(normalizedUrl);
  const preferredLanguage =
    requestedLanguage?.trim() || payload.language?.trim() || null;
  const manualTrackMap = extractYouTubeCaptionTrackMap(payload, "subtitles");
  const manualLanguage = matchPreferredYouTubeCaptionLanguage(
    getAvailableYouTubeCaptionLanguages(manualTrackMap),
    preferredLanguage
  );

  if (manualLanguage) {
    const manualTranscript = await downloadYouTubeCaptionTranscript({
      url: normalizedUrl,
      language: manualLanguage,
      source: "youtube_manual_captions",
    });
    if (manualTranscript) {
      return manualTranscript;
    }
  }

  const autoTrackMap = extractYouTubeCaptionTrackMap(payload, "automatic_captions");
  const autoLanguage = matchPreferredYouTubeCaptionLanguage(
    getAvailableYouTubeCaptionLanguages(autoTrackMap),
    preferredLanguage
  );

  if (!autoLanguage) {
    return null;
  }

  return downloadYouTubeCaptionTranscript({
    url: normalizedUrl,
    language: autoLanguage,
    source: "youtube_auto_captions",
  });
}

async function fetchLinkPayload(url: string): Promise<Payload> {
  try {
    const ytdlp = getYoutubeDlInstance();
    const baseFlags = {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      skipDownload: true,
    };
    const flags = isInstagramUrl(url)
      ? {
          ...baseFlags,
          ...buildInstagramYtDlpFlags(),
        }
      : baseFlags;
    const attempts = isInstagramUrl(url) ? INSTAGRAM_RETRY_ATTEMPTS : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return (await ytdlp(
          url,
          flags,
          {
            timeout: YTDLP_TIMEOUT_MS,
          }
        )) as Payload;
      } catch (error) {
        lastError = error;
        if (!isInstagramUrl(url)) {
          break;
        }

        if (!isInstagramEmptyMediaError(error)) {
          break;
        }
      }
    }

    throw lastError;
  } catch (error) {
    throw normalizeYtDlpError(error, "preview resolve");
  }
}

async function downloadLinkAudioToFile(
  url: string,
  outputTemplate: string,
  options?: {
    noContinue?: boolean;
  }
): Promise<Payload> {
  try {
    const ytdlp = getYoutubeDlInstance();
    const baseFlags = {
      format: "bestaudio/best",
      output: outputTemplate,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      noContinue: options?.noContinue ?? false,
    };
    const flags = isInstagramUrl(url)
      ? {
          ...baseFlags,
          ...buildInstagramYtDlpFlags(),
        }
      : baseFlags;
    const attempts = isInstagramUrl(url) ? INSTAGRAM_RETRY_ATTEMPTS : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return (await ytdlp(
          url,
          flags,
          {
            timeout: YTDLP_DOWNLOAD_TIMEOUT_MS,
          }
        )) as Payload;
      } catch (error) {
        lastError = error;
        if (!isInstagramUrl(url) || !isInstagramEmptyMediaError(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  } catch (error) {
    throw normalizeYtDlpError(error, "media download");
  }
}

async function resolveDownloadedFilePath(
  outputTemplate: string,
  explicitCandidates: Array<string | undefined>
): Promise<string> {
  const candidate = explicitCandidates.find((value) => value && existsSync(value));
  if (candidate) {
    return candidate;
  }

  if (outputTemplate.includes("%(ext)s")) {
    const outputDir = path.dirname(outputTemplate);
    const outputBase = path.basename(outputTemplate).replace("%(ext)s", "");
    const files = await readdir(outputDir).catch(() => []);
    const matchedFile =
      files.find((entry) => entry.startsWith(outputBase) && !entry.endsWith(".part")) ?? null;

    if (matchedFile) {
      return path.join(outputDir, matchedFile);
    }
  }

  throw new Error("yt-dlp download failed to produce a media file");
}

export function validateIncomingLink(url: string): string {
  const normalizedUrl = normalizeLinkUrl(url);
  if (!normalizedUrl) {
    throw new Error("Link is required");
  }

  if (!isValidHttpUrl(normalizedUrl)) {
    throw new Error("Please enter a valid media link");
  }

  ensureSafePublicUrl(normalizedUrl, "Link");
  return normalizedUrl;
}

export async function resolveLinkPreview(url: string): Promise<ResolvedLinkPreview> {
  const normalizedUrl = validateIncomingLink(url);
  try {
    const preview = await fetchLightweightLinkPreview(normalizedUrl);
    return preview;
  } catch (error) {
    if (!isInstagramUrl(normalizedUrl)) {
      throw error;
    }

    const classified = classifyInstagramPreviewFailure(error);
    if (classified?.reason === "link_not_public") {
      return {
        canonicalUrl: normalizedUrl,
        title: "Instagram post",
        durationMs: null,
        thumbnailUrl: null,
        sourceType: "video",
        extractor: "Instagram",
        status: "preview_only",
        reason: classified.reason,
        message: classified.message,
      };
    }

    const htmlPreview = await fetchInstagramHtmlPreview(normalizedUrl);
    if (htmlPreview) {
      if (classified) {
        return {
          ...htmlPreview,
          reason: classified.reason,
          message: classified.message,
        };
      }

      return htmlPreview;
    }

    if (classified) {
      return {
        canonicalUrl: normalizedUrl,
        title: "Instagram post",
        durationMs: null,
        thumbnailUrl: null,
        sourceType: "video",
        extractor: "Instagram",
        status: "preview_only",
        reason: classified.reason,
        message: classified.message,
      };
    }

    throw error;
  }
}

export async function resolveLinkMedia(url: string): Promise<ResolvedLinkMedia> {
  const normalizedUrl = validateIncomingLink(url);
  const payload = await fetchLinkPayload(normalizedUrl);
  const preview = buildPreviewFromPayload(payload, normalizedUrl);
  let output: unknown;
  try {
    const ytdlp = getYoutubeDlInstance();
    const baseFlags = {
      format: "bestaudio/best",
      getUrl: true,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
    };
    const flags = isInstagramUrl(normalizedUrl)
      ? {
          ...baseFlags,
          ...buildInstagramYtDlpFlags(),
        }
      : baseFlags;
    const attempts = isInstagramUrl(normalizedUrl) ? INSTAGRAM_RETRY_ATTEMPTS : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        output = await ytdlp(
          normalizedUrl,
          flags,
          {
            timeout: YTDLP_TIMEOUT_MS,
          }
        );
        break;
      } catch (error) {
        lastError = error;
        if (!isInstagramUrl(normalizedUrl) || !isInstagramEmptyMediaError(error)) {
          throw error;
        }
      }
    }

    if (output === undefined && lastError) {
      throw lastError;
    }
  } catch (error) {
    throw normalizeYtDlpError(error, "audio url resolve", YTDLP_TIMEOUT_MS);
  }

  const directAudioUrl = String(output || "").trim();
  if (!directAudioUrl) {
    throw new Error("Unable to resolve a downloadable audio stream");
  }

  ensureSafePublicUrl(directAudioUrl, "Resolved media url");
  const fileExtension = sanitizeExtension(
    payload.requested_downloads?.[0]?.ext ||
      payload.ext ||
      payload.requested_formats?.[0]?.audio_ext
  );

  return {
    ...preview,
    directAudioUrl,
    contentType: inferAudioContentType(fileExtension),
    fileSizeBytes:
      payload.requested_downloads?.[0]?.filesize_approx ||
      payload.filesize_approx ||
      null,
    fileExtension,
  };
}

export async function downloadLinkMediaToFile(
  url: string,
  outputTemplate: string,
  options?: {
    noContinue?: boolean;
  }
): Promise<DownloadedLinkMedia> {
  const normalizedUrl = validateIncomingLink(url);
  const payload = await downloadLinkAudioToFile(normalizedUrl, outputTemplate, options);
  const preview = buildPreviewFromPayload(payload, normalizedUrl);
  const fileExtension = sanitizeExtension(
    payload.requested_downloads?.[0]?.ext ||
      payload.ext ||
      payload.requested_formats?.[0]?.audio_ext
  );
  const requestedDownload = payload.requested_downloads?.[0] as
    | {
        filepath?: string;
        _filename?: string;
        filesize?: number;
        filesize_approx?: number;
      }
    | undefined;
  const payloadWithInternals = payload as Payload & {
    _filename?: string;
    filesize?: number;
  };
  const filePath = await resolveDownloadedFilePath(outputTemplate, [
    requestedDownload?.filepath,
    requestedDownload?._filename,
    payloadWithInternals._filename,
  ]);

  const fileSizeBytes =
    requestedDownload?.filesize ||
    requestedDownload?.filesize_approx ||
    payloadWithInternals.filesize ||
    payload.filesize_approx;

  return {
    preview,
    filePath,
    fileName: `${sanitizeFileName(preview.title)}.${fileExtension}`,
    fileExtension,
    contentType: inferAudioContentType(fileExtension),
    fileSizeBytes:
      fileSizeBytes && Number.isFinite(fileSizeBytes) && fileSizeBytes > 0
        ? Math.round(fileSizeBytes)
        : 0,
    sourceType: "audio",
    durationMs: preview.durationMs,
    title: preview.title,
    alreadyClippedForProcessing: false,
  };
}
