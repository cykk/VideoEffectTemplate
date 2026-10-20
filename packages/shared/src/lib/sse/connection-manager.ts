/**
 * Per-tab SSE connection manager.
 *
 * The browser keeps one SSE connection per tab. Multiple React consumers inside
 * the same tab share this manager instance.
 */

import { getPublicEnv } from "@markless/shared/src/lib/config/env";
import { buildClientSseUrl, isCrossOriginClientUrl } from "@markless/shared/src/lib/http/client";
import {
    isActiveAsyncTaskStatus,
    isTerminalAsyncTaskStatus,
    normalizeAsyncTaskStatus,
} from "@markless/shared/src/constants/async-task-status";

export interface StreamEventData {
    eventId: string;
    eventType: string;
    status?: string;
    payload?: Record<string, unknown> | null;
    updatedAt?: string;
}

export interface SSEMessage {
    type: "connected" | "event" | "error" | "timeout" | "heartbeat";
    data?: StreamEventData;
    message?: string;
    timestamp?: number;
    hasActiveEvents?: boolean;
}

export interface SSEStreamIdentity {
    mode: "session" | "anonymous";
    anonStreamToken?: string | null;
}

type MessageHandler = (message: SSEMessage) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionStateHandler = (isConnected: boolean) => void;

type GlobalSSEManagerStore = typeof globalThis & {
    __asyncTaskSseConnectionManager?: SSEConnectionManager;
};

const TAB_CLIENT_ID_STORAGE_KEY = "async_task_sse_tab_client_id";

function createClientId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getOrCreateTabClientId(): string {
    if (typeof window === "undefined") {
        return createClientId();
    }

    try {
        const existing = window.sessionStorage.getItem(TAB_CLIENT_ID_STORAGE_KEY);
        if (existing) {
            return existing;
        }

        const nextId = createClientId();
        window.sessionStorage.setItem(TAB_CLIENT_ID_STORAGE_KEY, nextId);
        return nextId;
    } catch {
        return createClientId();
    }
}

export class SSEConnectionManager {
    private static instance: SSEConnectionManager | null = null;

    private eventSource: EventSource | null = null;
    private readonly clientId = getOrCreateTabClientId();
    private refCount = 0;
    private messageHandlers = new Set<MessageHandler>();
    private errorHandlers = new Set<ErrorHandler>();
    private connectionStateHandlers = new Set<ConnectionStateHandler>();
    private isConnected = false;
    private isConnecting = false;
    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private lastHeartbeat = 0;
    private heartbeatCheckTimer: NodeJS.Timeout | null = null;
    private allTabsHidden = false;
    private activeEvents = new Map<string, string>();
    private streamIdentity: SSEStreamIdentity = {
        mode: "session",
        anonStreamToken: null,
    };

    private static readonly EVENT_CLEANUP_DELAY = 5 * 60 * 1000;
    private static readonly MAX_ACTIVE_EVENTS = 100;
    private readonly handleVisibilityChange = () => {
        this.checkTabVisibility();
    };

    private readonly handleBeforeUnload = () => {
        this.gracefulShutdown();
    };

    private constructor() {
        this.setupPageVisibility();
        this.setupPageLifecycle();
    }

    static getInstance(): SSEConnectionManager {
        if (typeof window !== "undefined") {
            const globalStore = globalThis as GlobalSSEManagerStore;
            if (!globalStore.__asyncTaskSseConnectionManager) {
                globalStore.__asyncTaskSseConnectionManager = new SSEConnectionManager();
            }
            return globalStore.__asyncTaskSseConnectionManager;
        }

        if (!SSEConnectionManager.instance) {
            SSEConnectionManager.instance = new SSEConnectionManager();
        }
        return SSEConnectionManager.instance;
    }

    private setupPageVisibility() {
        if (typeof document === "undefined") return;

        this.allTabsHidden = document.hidden;
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }

    private setupPageLifecycle() {
        if (typeof window === "undefined") return;

        window.addEventListener("beforeunload", this.handleBeforeUnload);
    }

    private checkTabVisibility() {
        if (typeof document === "undefined") return;

        if (document.hidden) {
            this.onTabHidden();
            return;
        }

        this.onTabVisible();
    }

    private onTabHidden() {
        if (this.allTabsHidden) return;

        this.allTabsHidden = true;
        if (this.hasActiveEvents()) {
            console.log("[SSE Manager] Tab hidden but has active events, staying connected");
            return;
        }

        console.log("[SSE Manager] Tab hidden and no active events, pausing connection");
        this.disconnect(true);
    }

    private onTabVisible() {
        if (!this.allTabsHidden) return;

        this.allTabsHidden = false;
        console.log("[SSE Manager] Tab visible, resuming connection");
        if (this.refCount > 0) {
            this.connect();
        }
    }

    private hasActiveEvents(): boolean {
        for (const status of this.activeEvents.values()) {
            if (isActiveAsyncTaskStatus(status)) {
                return true;
            }
        }
        return false;
    }

    private updateEventStatus(eventId: string, status: string) {
        const normalizedStatus = normalizeAsyncTaskStatus(status);
        this.activeEvents.set(eventId, normalizedStatus);

        if (isTerminalAsyncTaskStatus(normalizedStatus)) {
            setTimeout(() => {
                this.activeEvents.delete(eventId);
                this.pruneExcessEvents();
            }, SSEConnectionManager.EVENT_CLEANUP_DELAY);
        }

        this.pruneExcessEvents();
    }

    private pruneExcessEvents() {
        if (this.activeEvents.size <= SSEConnectionManager.MAX_ACTIVE_EVENTS) {
            return;
        }

        for (const [eventId, status] of this.activeEvents.entries()) {
            if (!isTerminalAsyncTaskStatus(status)) {
                continue;
            }

            this.activeEvents.delete(eventId);
            if (this.activeEvents.size <= SSEConnectionManager.MAX_ACTIVE_EVENTS) {
                break;
            }
        }
    }

    subscribe(
        onMessage: MessageHandler,
        onError?: ErrorHandler,
        onConnectionStateChange?: ConnectionStateHandler
    ): () => void {
        this.refCount++;
        console.log(`[SSE Manager] Subscribe (refCount: ${this.refCount}, handlers: ${this.messageHandlers.size + 1})`);

        this.messageHandlers.add(onMessage);
        if (onError) this.errorHandlers.add(onError);
        if (onConnectionStateChange) this.connectionStateHandlers.add(onConnectionStateChange);

        if (this.refCount === 1 && !this.allTabsHidden) {
            this.connect();
        } else if (this.isConnected) {
            onConnectionStateChange?.(true);
        }

        return () => {
            this.unsubscribe(onMessage, onError, onConnectionStateChange);
        };
    }

    setIdentity(identity: SSEStreamIdentity | null) {
        const nextIdentity: SSEStreamIdentity = identity
            ? {
                mode: identity.mode,
                anonStreamToken: identity.anonStreamToken ?? null,
            }
            : {
                mode: "session",
                anonStreamToken: null,
            };

        const changed =
            nextIdentity.mode !== this.streamIdentity.mode ||
            nextIdentity.anonStreamToken !== this.streamIdentity.anonStreamToken;

        this.streamIdentity = nextIdentity;

        if (!changed) {
            return;
        }

        if (this.refCount > 0 && !this.allTabsHidden) {
            this.disconnect(true);
            this.connect();
        }
    }

    private buildEventSourceUrl(): string {
        const sseUrl = new URL(buildClientSseUrl("/api/events/stream/user"));
        sseUrl.searchParams.set("clientId", this.clientId);

        if (
            this.streamIdentity.mode === "anonymous" &&
            this.streamIdentity.anonStreamToken
        ) {
            sseUrl.searchParams.set(
                "anonStreamToken",
                this.streamIdentity.anonStreamToken
            );
        }

        return sseUrl.toString();
    }

    private unsubscribe(
        onMessage: MessageHandler,
        onError?: ErrorHandler,
        onConnectionStateChange?: ConnectionStateHandler
    ) {
        this.refCount = Math.max(0, this.refCount - 1);
        this.messageHandlers.delete(onMessage);
        if (onError) this.errorHandlers.delete(onError);
        if (onConnectionStateChange) this.connectionStateHandlers.delete(onConnectionStateChange);

        console.log(`[SSE Manager] Unsubscribe (refCount: ${this.refCount}, handlers: ${this.messageHandlers.size})`);

        if (this.refCount === 0) {
            this.disconnect();
        }
    }

    private connect() {
        if (this.isConnected || this.isConnecting) {
            return;
        }

        if (this.allTabsHidden) {
            return;
        }

        this.isConnecting = true;
        const sseUrlString = this.buildEventSourceUrl();
        console.log("[SSE Manager] Connecting to", sseUrlString);

        try {
            this.eventSource = new EventSource(sseUrlString, {
                withCredentials: isCrossOriginClientUrl(sseUrlString),
            });

            this.eventSource.onopen = () => {
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.lastHeartbeat = Date.now();

                console.log("[SSE Manager] Connected");
                this.notifyConnectionStateHandlers(true);
                this.startHeartbeatCheck();
            };

            this.eventSource.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.eventSource.onerror = () => {
                const readyState = this.eventSource?.readyState;
                const details = {
                    readyState,
                    url: sseUrlString,
                    reconnectAttempts: this.reconnectAttempts,
                    hasActiveEvents: this.hasActiveEvents(),
                };

                if (getPublicEnv("NEXT_PUBLIC_APP_ENV") === "development") {
                    console.warn("[SSE Manager] Connection error", details);
                }
                this.handleConnectionError();
            };
        } catch (error) {
            console.error("[SSE Manager] Failed to create EventSource:", error);
            this.isConnecting = false;
            this.handleConnectionError();
        }
    }

    private disconnect(keepRefCount = false) {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.stopHeartbeatCheck();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;

        if (!keepRefCount) {
            this.refCount = 0;
            this.messageHandlers.clear();
            this.errorHandlers.clear();
            this.connectionStateHandlers.clear();
            this.activeEvents.clear();
        }

        if (wasConnected) {
            this.notifyConnectionStateHandlers(false);
        }
    }

    public gracefulShutdown(): void {
        this.disconnect(false);

        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        }

        if (typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.handleBeforeUnload);
        }

        this.reconnectAttempts = 0;
        this.allTabsHidden = false;
        this.lastHeartbeat = 0;
    }

    private handleMessage(data: string) {
        try {
            const parsed = JSON.parse(data);

            if (parsed.type === "heartbeat") {
                this.lastHeartbeat = Date.now();
                if (
                    getPublicEnv("NEXT_PUBLIC_APP_ENV") === "development" &&
                    parsed.hasActiveEvents !== undefined
                ) {
                    console.log(
                        `[SSE Manager] Heartbeat received (server hasActiveEvents: ${parsed.hasActiveEvents})`
                    );
                }
                return;
            }

            if (parsed.type === "connected") {
                return;
            }

            if (parsed.type === "error") {
                this.notifyErrorHandlers(new Error(parsed.message || "Server error"));
                return;
            }

            if (parsed.type === "timeout") {
                this.handleConnectionError();
                return;
            }

            if (parsed.type === "event" && parsed.eventId) {
                if (typeof parsed.status === "string") {
                    this.updateEventStatus(parsed.eventId, parsed.status);
                }

                this.notifyMessageHandlers({
                    type: "event",
                    data: parsed,
                    timestamp: Date.now(),
                });
            }
        } catch (error) {
            console.error("[SSE Manager] Failed to parse message:", error);
        }
    }

    private handleConnectionError() {
        const wasConnected = this.isConnected;

        this.isConnected = false;
        this.isConnecting = false;

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.stopHeartbeatCheck();

        if (wasConnected) {
            this.notifyConnectionStateHandlers(false);
        }

        if (this.refCount > 0 && !this.allTabsHidden) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000);
            console.log(`[SSE Manager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, delay);
        }
    }

    private startHeartbeatCheck() {
        this.stopHeartbeatCheck();
        this.lastHeartbeat = Date.now();

        const scheduleNextCheck = () => {
            const interval = this.hasActiveEvents() ? 15000 : 30000;
            this.heartbeatCheckTimer = setTimeout(() => {
                const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
                const timeoutThreshold = this.hasActiveEvents() ? 45000 : 120000;

                if (timeSinceLastHeartbeat > timeoutThreshold) {
                    console.warn(
                        `[SSE Manager] No heartbeat for ${Math.round(timeSinceLastHeartbeat / 1000)}s`
                    );
                    this.handleConnectionError();
                    return;
                }

                scheduleNextCheck();
            }, interval);
        };

        scheduleNextCheck();
    }

    private stopHeartbeatCheck() {
        if (this.heartbeatCheckTimer) {
            clearTimeout(this.heartbeatCheckTimer);
            this.heartbeatCheckTimer = null;
        }
    }

    private notifyMessageHandlers(message: SSEMessage) {
        this.messageHandlers.forEach((handler) => {
            try {
                handler(message);
            } catch (error) {
                console.error("[SSE Manager] Message handler error:", error);
            }
        });
    }

    private notifyErrorHandlers(error: Error) {
        this.errorHandlers.forEach((handler) => {
            try {
                handler(error);
            } catch (handlerError) {
                console.error("[SSE Manager] Error handler error:", handlerError);
            }
        });
    }

    private notifyConnectionStateHandlers(isConnected: boolean) {
        this.connectionStateHandlers.forEach((handler) => {
            try {
                handler(isConnected);
            } catch (error) {
                console.error("[SSE Manager] Connection state handler error:", error);
            }
        });
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            refCount: this.refCount,
            reconnectAttempts: this.reconnectAttempts,
            allTabsHidden: this.allTabsHidden,
            lastHeartbeat: this.lastHeartbeat,
        };
    }
}

export function getSSEManager() {
    return SSEConnectionManager.getInstance();
}
