export const CLIENT_PUBLIC_ENV = {
  NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_AUTH_BASE_URL: process.env.NEXT_PUBLIC_AUTH_BASE_URL,
  NEXT_PUBLIC_SSE_BASE_URL: process.env.NEXT_PUBLIC_SSE_BASE_URL,
  NEXT_PUBLIC_BROWSER_API_BASE_URL:
    process.env.NEXT_PUBLIC_BROWSER_API_BASE_URL,
  NEXT_PUBLIC_BROWSER_AUTH_BASE_URL:
    process.env.NEXT_PUBLIC_BROWSER_AUTH_BASE_URL,
  NEXT_PUBLIC_BROWSER_SSE_BASE_URL:
    process.env.NEXT_PUBLIC_BROWSER_SSE_BASE_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
} as const;

export type ClientPublicEnvKey = keyof typeof CLIENT_PUBLIC_ENV;

export function getClientPublicEnv(
  name: ClientPublicEnvKey,
  fallback?: string
): string | undefined {
  const value = CLIENT_PUBLIC_ENV[name];
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}
