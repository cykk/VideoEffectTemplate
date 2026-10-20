import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSSEManager,
  type SSEMessage,
  type SSEStreamIdentity,
  type StreamEventData,
} from "@markless/shared/src/lib/sse/connection-manager";

export type UserStreamEventData = StreamEventData;

export interface UserStreamOptions {
  enabled?: boolean;
  streamIdentity?: SSEStreamIdentity | null;
  onUpdate?: (data: UserStreamEventData) => void;
  onConnectionStateChange?: (isConnected: boolean) => void;
  onError?: (error: Error) => void;
}

export interface UserStreamState {
  events: Map<string, UserStreamEventData>;
  isConnected: boolean;
  error: Error | null;
}

export function useUserStream(
  options: UserStreamOptions = {}
): UserStreamState & {
  getEvent: (eventId: string) => UserStreamEventData | undefined;
} {
  const {
    enabled = true,
    streamIdentity,
    onUpdate,
    onConnectionStateChange,
    onError,
  } = options;

  const onUpdateRef = useRef(onUpdate);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onConnectionStateChangeRef.current = onConnectionStateChange;
    onErrorRef.current = onError;
  });

  const [state, setState] = useState<UserStreamState>({
    events: new Map(),
    isConnected: false,
    error: null,
  });

  const getEvent = useCallback(
    (eventId: string) => state.events.get(eventId),
    [state.events]
  );

  useEffect(() => {
    const manager = getSSEManager();
    manager.setIdentity(streamIdentity ?? null);

    if (!enabled) {
      setState({
        events: new Map(),
        isConnected: false,
        error: null,
      });
      return;
    }

    const handleMessage = (message: SSEMessage) => {
      if (message.type !== "event" || !message.data) {
        return;
      }

      const eventData = message.data;
      setState((prev) => {
        const nextEvents = new Map(prev.events);
        nextEvents.set(eventData.eventId, eventData);
        return {
          ...prev,
          events: nextEvents,
        };
      });

      onUpdateRef.current?.(eventData);
    };

    const handleError = (error: Error) => {
      setState((prev) => ({
        ...prev,
        error,
      }));
      onErrorRef.current?.(error);
    };

    const handleConnectionStateChange = (isConnected: boolean) => {
      setState((prev) => ({
        ...prev,
        isConnected,
        error: isConnected ? null : prev.error,
      }));
      onConnectionStateChangeRef.current?.(isConnected);
    };

    return manager.subscribe(
      handleMessage,
      handleError,
      handleConnectionStateChange
    );
  }, [enabled, streamIdentity]);

  return {
    ...state,
    getEvent,
  };
}

export function useSSEStatus() {
  const [status, setStatus] = useState(() => getSSEManager().getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getSSEManager().getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
