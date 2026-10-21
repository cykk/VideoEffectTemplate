"use client";

import { useState, useCallback } from "react";
import { defaultLocale } from "@markless/shared/src/i18n";

const POST_AUTH_INTENT_KEY = "post-auth-intent";
const PENDING_CHECKOUT_CONTEXT_KEY = "pending-checkout-context";

export type PostAuthIntent = "go_dashboard" | "resume_checkout" | "resume_upgrade";

export interface PendingCheckoutContext {
    productId: string;
    entrySurface: string;
    returnTo?: string | null;
    locale?: string | null;
    sourcePage?: string | null;
    timestamp: number;
}

function normalizeRedirectTarget(target?: string | null): string | null {
    if (!target) return null;
    const trimmed = target.trim();
    return trimmed ? trimmed : null;
}

function resolveOAuthCallbackUrl(target?: string | null): string | null {
    if (typeof window === "undefined") return null;

    const normalized = normalizeRedirectTarget(target);
    if (!normalized) return null;

    try {
        return new URL(normalized, window.location.origin).toString();
    } catch {
        return null;
    }
}

export function buildMembershipUrl(locale?: string | null): string {
    if (!locale || locale === defaultLocale) {
        return "/settings/billing";
    }

    return `/${locale}/settings/billing`;
}

export function buildDashboardUrl(locale?: string | null): string {
    if (!locale || locale === defaultLocale) {
        return "/dashboard";
    }

    return `/${locale}/dashboard`;
}

export function buildPricingUrl(locale?: string | null): string {
    if (!locale || locale === defaultLocale) {
        return "/pricing";
    }

    return `/${locale}/pricing`;
}

export function buildCheckoutResumeUrl(locale?: string | null): string {
    if (!locale || locale === defaultLocale) {
        return "/checkout/resume";
    }

    return `/${locale}/checkout/resume`;
}

/**
 * OAuth 回调 URL 处理 Hook
 *
 * 封装登录/注册前的 OAuth 回调 URL 设置逻辑
 * 确保用户登录后能返回到触发登录的页面
 *
 * @example
 * ```tsx
 * const { showAuthModal, authMode, openLogin, openSignUp, closeAuth, setAuthMode } = useAuthAction();
 *
 * <button onClick={openLogin}>Login</button>
 * <button onClick={openSignUp}>Sign Up</button>
 * <AuthModal open={showAuthModal} onOpenChange={closeAuth} mode={authMode} onModeChange={setAuthMode} />
 * ```
 */
export function useAuthAction() {
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

    /**
     * 设置 OAuth 回调 URL 到 localStorage
     * 登录成功后，OAuth 回调会读取此 URL 进行跳转
     */
    const setOAuthCallback = useCallback((target?: string | null) => {
        if (typeof window === 'undefined') return;

        const url = resolveOAuthCallbackUrl(target) ?? window.location.href;
        localStorage.setItem('oauth-callback-target', JSON.stringify({
            url,
            timestamp: Date.now()
        }));
    }, []);

    const setPostAuthIntent = useCallback((intent?: PostAuthIntent | null) => {
        if (typeof window === "undefined") return;
        if (!intent) {
            localStorage.removeItem(POST_AUTH_INTENT_KEY);
            return;
        }
        localStorage.setItem(POST_AUTH_INTENT_KEY, intent);
    }, []);

    /**
     * 打开登录弹窗
     * 自动设置 OAuth 回调 URL 为当前页面
     */
    const openLogin = useCallback((intent: PostAuthIntent = "go_dashboard", redirectTo?: string | null) => {
        setOAuthCallback(redirectTo);
        setPostAuthIntent(intent);
        setAuthMode('signin');
        setShowAuthModal(true);
    }, [setOAuthCallback, setPostAuthIntent]);

    /**
     * 打开注册弹窗
     * 自动设置 OAuth 回调 URL 为当前页面
     */
    const openSignUp = useCallback((intent: PostAuthIntent = "go_dashboard", redirectTo?: string | null) => {
        setOAuthCallback(redirectTo);
        setPostAuthIntent(intent);
        setAuthMode('signup');
        setShowAuthModal(true);
    }, [setOAuthCallback, setPostAuthIntent]);

    /**
     * 打开游客次数用尽专用注册弹窗
     */

    /**
     * 关闭认证弹窗
     */
    const closeAuth = useCallback((open: boolean) => {
        setShowAuthModal(open);
    }, []);

    return {
        showAuthModal,
        authMode,
        openLogin,
        openSignUp,
        closeAuth,
        setAuthMode,
    };
}

export function readPostAuthIntent(): PostAuthIntent | null {
    if (typeof window === "undefined") return null;
    const value = localStorage.getItem(POST_AUTH_INTENT_KEY);
    return value === "go_dashboard" ||
        value === "resume_checkout" ||
        value === "resume_upgrade"
        ? value
        : null;
}

export function clearPostAuthIntent() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(POST_AUTH_INTENT_KEY);
}

export function persistPendingCheckoutContext(
    context: Omit<PendingCheckoutContext, "timestamp">
) {
    if (typeof window === "undefined") return;

    localStorage.setItem(
        PENDING_CHECKOUT_CONTEXT_KEY,
        JSON.stringify({
            ...context,
            timestamp: Date.now(),
        } satisfies PendingCheckoutContext)
    );
}

export function readPendingCheckoutContext(): PendingCheckoutContext | null {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(PENDING_CHECKOUT_CONTEXT_KEY);
    if (!raw) {
        return null;
    }

    try {
        const payload = JSON.parse(raw) as PendingCheckoutContext;
        if (Date.now() - (payload.timestamp || 0) > 30 * 60 * 1000) {
            localStorage.removeItem(PENDING_CHECKOUT_CONTEXT_KEY);
            return null;
        }

        if (!payload.productId || !payload.entrySurface) {
            localStorage.removeItem(PENDING_CHECKOUT_CONTEXT_KEY);
            return null;
        }

        return payload;
    } catch {
        localStorage.removeItem(PENDING_CHECKOUT_CONTEXT_KEY);
        return null;
    }
}

export function clearPendingCheckoutContext() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(PENDING_CHECKOUT_CONTEXT_KEY);
}
