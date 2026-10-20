"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@markless/shared/src/lib/http/client";

export type UserCreditsData = {
  credits: number;
  creditsBreakdown: {
    totalBalance: number;
    subscriptionCredits: number;
    purchasedCredits: number;
    bonusCredits: number;
  } | null;
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

export const USER_CREDITS_QUERY_KEY = ["user-credits"] as const;

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

export async function fetchUserCredits(): Promise<UserCreditsData> {
  const response = await apiFetch("/api/user/credits", {
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<UserCreditsData>
    | null;

  if (!response.ok || !payload?.success || payload.data === null) {
    throw new Error(resolveApiErrorMessage(response.status, payload));
  }

  return payload.data;
}

export function useUserCredits(options?: {
  enabled?: boolean;
  initialData?: UserCreditsData | null;
}) {
  const { enabled = true, initialData = null } = options ?? {};

  const { data, isLoading, error, refetch } = useQuery<UserCreditsData>({
    queryKey: USER_CREDITS_QUERY_KEY,
    queryFn: fetchUserCredits,
    enabled,
    initialData: initialData ?? undefined,
    staleTime: 1000 * 30,
    retry: 0,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    reload: refetch,
  };
}
