import { readFile } from "node:fs/promises";

const dictionary = JSON.parse(await readFile(
  new URL("../../packages/shared/src/i18n/locales/en.json", import.meta.url), "utf8"
));
const legal = JSON.stringify({ privacy: dictionary.pages.privacy, terms: dictionary.pages.terms });
const failures = [];

if (process.env.LEGAL_CONTENT_READY !== "true") failures.push("LEGAL_CONTENT_READY must be true");
if (/mp3\s?to\s?text|mp3totext|transcri(?:be|pt|ption)|subtitle|guest audio|uploaded audio/i.test(legal)) {
  failures.push("Replace the historical transcription privacy policy and terms");
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SUPPORT_EMAIL || "")) {
  failures.push("Set a valid SUPPORT_EMAIL");
}
for (const key of ["NEXT_PUBLIC_WEB_URL", "NEXT_PUBLIC_APP_URL"]) {
  try {
    const url = new URL(process.env[key]);
    if (url.protocol !== "https:" || /example\.|localhost|marklessdev\./i.test(url.hostname)) {
      failures.push(`Set a production HTTPS ${key}`);
    }
  } catch {
    failures.push(`Set a valid ${key}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[launch-check] ${failure}`);
  process.exitCode = 1;
} else {
  console.log("[launch-check] Public content and origins are configured");
}
