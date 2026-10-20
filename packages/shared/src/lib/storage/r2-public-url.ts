import { getEnv } from "@markless/shared/src/lib/config/env";
import { buildR2PublicUrl } from "@markless/server/src/lib/storage/r2-core";

const R2_PUBLIC_DOMAIN = getEnv("R2_PUBLIC_DOMAIN") || "";
const R2_BUCKET_NAME = getEnv("R2_BUCKET_NAME") || "";
const R2_ACCOUNT_ID = getEnv("R2_ACCOUNT_ID") || "";

export function getR2PublicUrl(key?: string | null): string | null {
  if (!key) {
    return null;
  }

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  // 本地 public 目录路径（开发环境）
  if (key.startsWith("/")) {
    return key;
  }

  if (R2_PUBLIC_DOMAIN) {
    return buildR2PublicUrl(R2_PUBLIC_DOMAIN, key);
  }

  if (R2_BUCKET_NAME && R2_ACCOUNT_ID) {
    return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
  }

  return null;
}
