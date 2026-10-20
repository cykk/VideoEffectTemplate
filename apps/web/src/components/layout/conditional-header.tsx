"use client";

import { usePathname } from "next/navigation";
import { locales } from "@markless/shared/src/i18n/types";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";
import { Header } from "./header";

interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const localePattern = new RegExp(`^/(${locales.join("|")})($|/)`);

function resolveHeaderMode(pathname: string): "marketing" | "app" | "none" {
  const cleanPath = pathname.replace(localePattern, "/");

  if (cleanPath.startsWith("/admin") || cleanPath.startsWith("/transcriptions/") || cleanPath.startsWith("/share/") || cleanPath.startsWith("/redeem")) {
    return "none";
  }

  if (cleanPath.startsWith("/dashboard") || cleanPath.startsWith("/settings")) {
    return "app";
  }

  return "marketing";
}

export function ConditionalHeader({
  loading = false,
  authenticated = false,
  user = null,
  entitlements = null,
  isAdmin = false,
}: {
  loading?: boolean;
  authenticated?: boolean;
  user?: HeaderUser | null;
  entitlements?: UserEntitlements | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const mode = resolveHeaderMode(pathname);

  if (mode === "none") {
    return null;
  }

  return (
    <Header
      loading={loading}
      authenticated={authenticated}
      user={user}
      entitlements={entitlements}
      isAdmin={isAdmin}
      variant={mode}
    />
  );
}
