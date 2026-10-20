"use client";

import { PlanUsageBadge } from "@/components/header/plan-usage-badge";
import { NotificationCenter } from "@/components/header/notification-center";
import { UserMenu } from "@/components/layout/user-menu";
import type { Locale, HeaderDictionary } from "@markless/shared/src/i18n/types";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

interface UserActionBarProps {
  entitlements?: UserEntitlements | null;
  entitlementsLoading?: boolean;
  locale: Locale;
  dictionary: HeaderDictionary;
  isAdmin?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  mode?: "marketing" | "app";
}

export function UserActionBar({
  entitlements = null,
  entitlementsLoading = false,
  locale,
  dictionary,
  isAdmin = false,
  user,
  mode = "app",
}: UserActionBarProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5">
      {mode === "app" ? (
        <PlanUsageBadge
          entitlements={entitlements}
          loading={entitlementsLoading}
          locale={locale}
          dictionary={dictionary.planUsage}
        />
      ) : null}

      {mode === "app" ? <NotificationCenter /> : null}

      <UserMenu
        dictionary={dictionary}
        locale={locale}
        isAdmin={isAdmin}
        user={user}
      />
    </div>
  );
}
