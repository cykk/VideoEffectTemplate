import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

function resolveAuthClientBaseUrl(): string | undefined {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_BROWSER_AUTH_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return undefined;
}

const baseURL = resolveAuthClientBaseUrl();

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
  ...(baseURL ? { baseURL } : {}),
});
