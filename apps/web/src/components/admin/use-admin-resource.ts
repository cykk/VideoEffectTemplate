"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@markless/shared/src/lib/http/client";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
};

function resolveApiErrorMessage(status: number, payload: ApiEnvelope<unknown> | null) {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (status === 401) {
    return "Authentication required";
  }

  if (status === 403) {
    return "Admin access required";
  }

  return `Request failed with status ${status}`;
}

async function fetchApiResource<T>(path: string): Promise<T> {
  const response = await apiFetch(path, {
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.success || payload.data === null) {
    throw new Error(resolveApiErrorMessage(response.status, payload));
  }

  return payload.data;
}

export function useAdminResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextData = await fetchApiResource<T>(path);
      setData(nextData);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load admin resource"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reload,
  };
}

