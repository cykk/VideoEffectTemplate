import type { NextRequest } from "next/server";
import { getEnv } from "@markless/shared/src/lib/config/env";

const DEFAULT_WEB_URL =
  getEnv("NODE_ENV") === "development"
    ? "http://localhost:3000"
    : "https://mp3totext.io";

function normalizeBaseUrl(value?: string): string {
  const base = (value || DEFAULT_WEB_URL).trim();
  return base.replace(/\/$/, "");
}

function ensureHttpsUrl(baseUrl: string, envName: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`${envName} must be a valid absolute URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${envName} must use https:// for external webhooks`);
  }

  return parsed.toString().replace(/\/$/, "");
}

export function getWebBaseUrl(): string {
  return normalizeBaseUrl(getEnv("NEXT_PUBLIC_WEB_URL"));
}

export function getPaymentSuccessBaseUrl(): string {
  return normalizeBaseUrl(
    getEnv("PAYMENT_SUCCESS_BASE_URL") || getEnv("NEXT_PUBLIC_WEB_URL")
  );
}

export function getApiBaseUrl(_req?: NextRequest): string {
  const appUrl = getEnv("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    return normalizeBaseUrl(appUrl);
  }

  return getWebBaseUrl();
}

function joinUrl(baseUrl: string, path?: string): string {
  if (!path) {
    return baseUrl;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

export function buildWebUrl(path?: string): string {
  return joinUrl(getWebBaseUrl(), path);
}

export function buildApiUrl(path?: string, req?: NextRequest): string {
  return joinUrl(getApiBaseUrl(req), path);
}

export function getWebhookBaseUrl(req?: NextRequest): string {
  const appUrl = getEnv("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    return ensureHttpsUrl(appUrl, "NEXT_PUBLIC_APP_URL");
  }

  const webUrl = getEnv("NEXT_PUBLIC_WEB_URL");
  if (webUrl) {
    return ensureHttpsUrl(webUrl, "NEXT_PUBLIC_WEB_URL");
  }

  return ensureHttpsUrl(getApiBaseUrl(req), "NEXT_PUBLIC_APP_URL");
}

export function buildWebhookUrl(path?: string, req?: NextRequest): string {
  return joinUrl(getWebhookBaseUrl(req), path);
}
