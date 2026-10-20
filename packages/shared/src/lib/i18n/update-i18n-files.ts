import { promises as fs } from "node:fs";
import path from "node:path";

type I18nUpdate = {
  key: string;
  en: unknown;
};

const enPath = path.join(process.cwd(), "src", "i18n", "locales", "en.json");

function setValue(target: Record<string, unknown>, key: string, value: unknown) {
  const segments = key.split(".");
  let current: Record<string, unknown> = target;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (i === segments.length - 1) {
      current[segment] = value;
      return;
    }

    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }
}

export async function updateI18nFiles(updates: I18nUpdate[]) {
  const enRaw = await fs.readFile(enPath, "utf8");

  const enJson = JSON.parse(enRaw) as Record<string, unknown>;

  for (const update of updates) {
    setValue(enJson, update.key, update.en);
  }

  const nextEn = JSON.stringify(enJson, null, 4);

  await fs.writeFile(enPath, nextEn, "utf8");
}
