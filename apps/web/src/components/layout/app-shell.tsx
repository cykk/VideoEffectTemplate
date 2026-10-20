"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConditionalHeader, FooterWrapper } from "@/components/layout";
import { useAuthenticatedUserCredits } from "@/hooks/use-authenticated-user-credits";
import {
  USER_CREDITS_QUERY_KEY,
  type UserCreditsData,
} from "@/hooks/use-user-credits";
import { useLocale } from "@/hooks";
import {
  PAYMENT_CREDITS_REFRESH_EVENT,
  consumeCreditsRefreshPending,
} from "@markless/shared/src/lib/payments/client-checkout";
import { refreshUserBootstrap } from "@/lib/query/user-query-refresh";
import { usePendingTranscriptionAutoClaim } from "@/hooks/use-pending-transcription-auto-claim";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    bootstrap,
    bootstrapLoading,
    reloadCredits,
  } = useAuthenticatedUserCredits();
  const queryClient = useQueryClient();
  const { locale } = useLocale();

  usePendingTranscriptionAutoClaim(bootstrap?.authenticated);

  useEffect(() => {
    let cancelled = false;
    let refreshInFlight = false;
    let pendingRefresh = false;

    const refreshCredits = async () => {
      if (cancelled) return;

      if (refreshInFlight) {
        pendingRefresh = true;
        return;
      }

      refreshInFlight = true;

      try {
        if (bootstrap?.authenticated) {
          await refreshUserBootstrap(queryClient);
          const refreshedCredits = await reloadCredits();
          const nextCredits = refreshedCredits.data ?? null;

          if (nextCredits) {
            queryClient.setQueryData<UserCreditsData>(
              USER_CREDITS_QUERY_KEY,
              nextCredits
            );
          }
        }
      } catch {
      } finally {
        refreshInFlight = false;

        if (pendingRefresh && !cancelled) {
          pendingRefresh = false;
          void refreshCredits();
        }
      }
    };

    if (consumeCreditsRefreshPending()) {
      void refreshCredits();
    }

    const handleCreditsRefresh = () => {
      void refreshCredits();
    };

    window.addEventListener(
      PAYMENT_CREDITS_REFRESH_EVENT,
      handleCreditsRefresh
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        PAYMENT_CREDITS_REFRESH_EVENT,
        handleCreditsRefresh
      );
    };
  }, [bootstrap?.authenticated, queryClient, reloadCredits]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="flex min-h-screen flex-col">
      <ConditionalHeader
        loading={bootstrapLoading}
        authenticated={bootstrap?.authenticated ?? false}
        user={bootstrap?.user as { name?: string | null; email?: string | null; image?: string | null } | null}
        entitlements={bootstrap?.entitlements ?? null}
        isAdmin={bootstrap?.isAdmin ?? false}
      />
      <main className="flex-1">{children}</main>
      <FooterWrapper />
    </div>
  );
}
