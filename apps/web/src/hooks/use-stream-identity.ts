"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SSEStreamIdentity } from "@markless/shared/src/lib/sse/connection-manager";
import { apiFetch } from "@markless/shared/src/lib/http/client";

type StreamBootstrapPayload = {
  ready: boolean;
  authenticated: boolean;
  streamMode: "session";
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
  } | null;
};

interface StreamIdentityState {
  ready: boolean;
  loading: boolean;
  authenticated: boolean;
  identity: SSEStreamIdentity | null;
}

const INITIAL_STATE: StreamIdentityState = {
  ready: false,
  loading: false,
  authenticated: false,
  identity: null,
};

function buildIdentity(): SSEStreamIdentity | null {
  return {
    mode: "session",
    anonStreamToken: null,
  };
}

function resolveApiErrorMessage(
  response: Response,
  payload: ApiEnvelope<unknown> | null
): string {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  return `Request failed with status ${response.status}`;
}

export function useStreamIdentity(enabled: boolean) {
  const [state, setState] = useState<StreamIdentityState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const inFlightRef = useRef<Promise<StreamIdentityState> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchIdentity = useCallback(async () => {
    const response = await apiFetch("/api/events/stream/bootstrap", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<StreamBootstrapPayload>
      | null;

    if (!response.ok || !payload?.success || !payload.data) {
      throw new Error(resolveApiErrorMessage(response, payload));
    }

    const nextState: StreamIdentityState = {
      ready: payload.data.ready,
      loading: false,
      authenticated: payload.data.authenticated,
      identity: buildIdentity(),
    };

    setState(nextState);
    return nextState;
  }, []);

  const ensureReady = useCallback(async () => {
    if (stateRef.current.ready && stateRef.current.identity) {
      return stateRef.current;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
    }));

    const request = fetchIdentity()
      .catch((error) => {
        setState({
          ...INITIAL_STATE,
          loading: false,
        });
        throw error;
      })
      .finally(() => {
        inFlightRef.current = null;
      });

    inFlightRef.current = request;
    return request;
  }, [fetchIdentity]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (stateRef.current.ready && stateRef.current.identity) {
      return;
    }

    void ensureReady();
  }, [enabled, ensureReady]);

  return {
    ...state,
    ensureReady,
  };
}
