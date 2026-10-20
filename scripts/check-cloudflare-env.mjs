const required = [
  "NEXT_PUBLIC_WEB_URL",
  "NEXT_PUBLIC_BROWSER_API_BASE_URL",
  "NEXT_PUBLIC_BROWSER_AUTH_BASE_URL",
  "NEXT_PUBLIC_BROWSER_SSE_BASE_URL",
];
for (const key of required) {
  const value = process.env[key];
  let isHttps = false;
  try {
    isHttps = new URL(value || "").protocol === "https:";
  } catch {
    isHttps = false;
  }
  if (!isHttps) {
    throw new Error(`${key} must be an absolute HTTPS URL. Copy .env.web.cloudflare.example to .env.web.cloudflare and configure it first.`);
  }
}
if (process.env.NEXT_PUBLIC_BROWSER_API_BASE_URL !== process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BROWSER_AUTH_BASE_URL !== process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BROWSER_SSE_BASE_URL !== process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("Browser API, auth, and SSE URLs must point to the configured API origin.");
}
console.log("Cloudflare public build environment validated.");
