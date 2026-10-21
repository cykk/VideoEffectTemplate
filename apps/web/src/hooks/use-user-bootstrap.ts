"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

type UserBootstrapUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  [key: string]: unknown;
};

type UserBootstrapData = {
  authenticated: boolean;
  user: UserBootstrapUser | null;
  credits: number;
  creditsBreakdown: {
    totalBalance: number;
    subscriptionCredits: number;
    purchasedCredits: number;
    bonusCredits: number;
  } | null;
  subscription: {
    planId: string;
    planName: string;
    status: string;
    interval: string;
    currentPeriodEnd: string | null;
    creditsPerPeriod: number;
  } | null;
  entitlements: UserEntitlements | null;
  isAdmin: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
};

export const USER_BOOTSTRAP_QUERY_KEY = ["user-bootstrap"] as const;

export const SIGNED_OUT_BOOTSTRAP: UserBootstrapData = {
  authenticated: false,
  user: null,
  credits: 0,
  creditsBreakdown: null,
  subscription: null,
  entitlements: null,
  isAdmin: false,
};

function resolveApiErrorMessage(
  status: number,
  payload: ApiEnvelope<unknown> | null
): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (status === 401) {
    return "Authentication required";
  }

  if (status === 403) {
    return "Access denied";
  }

  return `Request failed with status ${status}`;
}

export async function fetchUserBootstrap(): Promise<UserBootstrapData> {
  try {
    const response = await apiFetch("/api/user/bootstrap", {
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<UserBootstrapData>
      | null;

    if (!response.ok || !payload?.success || payload.data === null) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[user-bootstrap]",
          resolveApiErrorMessage(response.status, payload)
        );
      }
      return SIGNED_OUT_BOOTSTRAP;
    }

    return payload.data;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[user-bootstrap] request failed:", error);
    }
    return SIGNED_OUT_BOOTSTRAP;
  }
}

export function useUserBootstrap(initialData?: UserBootstrapData | null) {
  const { data, isLoading, error, refetch, isFetched } = useQuery<UserBootstrapData>({
    queryKey: USER_BOOTSTRAP_QUERY_KEY,
    queryFn: fetchUserBootstrap,
    initialData: initialData ?? undefined,
    placeholderData: SIGNED_OUT_BOOTSTRAP,
    staleTime: 1000 * 30,
    retry: 1,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    isFetched,
    error: error instanceof Error ? error.message : null,
    reload: refetch,
  };
}

export type { UserBootstrapData };
export type { UserBootstrapUser };
