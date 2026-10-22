"use client";

import { useEffect, useState, FormEvent } from "react";
import { authClient } from "@markless/shared/src/lib/auth/client";
import { getClientAuthBaseUrl } from "@markless/shared/src/lib/http/client";
import { cn } from "@markless/shared/src/lib/utils";

// --- Types ---

import { AuthFormDictionary } from "@markless/shared/src/i18n/types";

interface AuthFormProps {
    dictionary: AuthFormDictionary;
    onSuccess?: () => void;
    className?: string;
    isModal?: boolean;
    mode?: 'signin' | 'signup';
    /** 传入后，在内置浏览器中隐藏 Google 登录并展示提示。 */
    inAppNotice?: { title: string; description: string; copyLink: string; copied: string };
}

// --- Icons ---

const GoogleLogo = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgb(66, 133, 244)" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgb(52, 168, 83)" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="rgb(251, 188, 5)" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgb(234, 67, 53)" />
    </svg>
);

const Spinner = () => (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Helper: Get OAuth callback URL ---

/**
 * 获取 OAuth 回调 URL
 *
 * 优先使用 localStorage 中保存的目标 URL（来自营销页提交流程）
 * 如果没有或已过期（5分钟），则使用当前页面 URL
 */
function getOAuthCallbackURL(): string {
    try {
        const stored = localStorage.getItem('oauth-callback-target');
        if (stored) {
            const data = JSON.parse(stored);
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            // 检查是否过期
            if (data.url && data.timestamp && (now - data.timestamp < fiveMinutes)) {
                // 读取后立即清除，防止影响后续登录
                localStorage.removeItem('oauth-callback-target');
                return new URL(data.url, window.location.origin).toString();
            } else {
                // 已过期，清除
                localStorage.removeItem('oauth-callback-target');
            }
        }
    } catch {
        localStorage.removeItem('oauth-callback-target');
    }

    return window.location.href;
}

function buildOAuthStartUrl(provider: "google", callbackURL: string): string {
    const startUrl = new URL(
        `/api/auth/oauth/${provider}/start`,
        getClientAuthBaseUrl(),
    );
    startUrl.searchParams.set("callbackURL", callbackURL);
    return startUrl.toString();
}

const ENABLE_MAGIC_LINK = true;

/**
 * TikTok / Instagram / Facebook 等应用内置浏览器会被 Google 以 disallowed_useragent 拒绝 OAuth。
 * 这里只做 UA 粗略识别，识别到后改为邮箱登录优先，并提示用户可复制链接到系统浏览器。
 */
const IN_APP_BROWSER_PATTERN = /(musical_ly|bytedancewebview|tiktok|trill|instagram|fban|fbav|fb_iab|line\/|snapchat|micromessenger|twitter)/i;

function isInAppBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    return IN_APP_BROWSER_PATTERN.test(navigator.userAgent);
}

// --- Component ---

export function AuthForm({ dictionary, onSuccess, className, isModal = false, mode: _mode = 'signin', inAppNotice }: AuthFormProps) {
    const [pendingProvider, setPendingProvider] = useState<"google" | null>(null);
    const [inApp, setInApp] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        setInApp(isInAppBrowser());
    }, []);

    const hideGoogle = inApp && Boolean(inAppNotice);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
            setLinkCopied(true);
            window.setTimeout(() => setLinkCopied(false), 2500);
        } catch {
            setLinkCopied(false);
        }
    };
    const [magicEmail, setMagicEmail] = useState("");
    const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [magicMessage, setMagicMessage] = useState<string | null>(null);

    const handleOAuth = async (provider: "google") => {
        setPendingProvider(provider);

        // 获取回调 URL（可能来自营销页的目标路径）
        const callbackURL = getOAuthCallbackURL();

        try {
            const startUrl = buildOAuthStartUrl(provider, callbackURL);
            window.location.assign(startUrl);
        } catch (error) {
            console.error(`[Better Auth] ${provider} sign-in failed`, error);
            setPendingProvider(null);
        }
    };

    const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!magicEmail) {
            setMagicMessage(dictionary.messages.emptyEmail);
            setMagicStatus("error");
            return;
        }

        setMagicStatus("sending");
        setMagicMessage(null);

        try {
            // 获取回调 URL（可能来自营销页的目标路径）
            const callbackURL = getOAuthCallbackURL();

            const response = await authClient.signIn.magicLink({
                email: magicEmail,
                callbackURL,
            });

            if (response?.error) {
                const errorMessage = response.error.message ?? dictionary.messages.responseError;

                // Check if it's a rate limit error
                const isRateLimitError = errorMessage.includes('Too many magic link requests');

                setMagicMessage(errorMessage);
                setMagicStatus("error");

                // Log rate limit violations for monitoring
                if (isRateLimitError) {
                    console.warn('[Auth] Rate limit exceeded for magic link:', { email: magicEmail });
                }
                return;
            }

            // Success - just set status, message is shown via dictionary
            setMagicStatus("sent");
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("[Better Auth] Magic link request failed", error);
            setMagicStatus("error");

            // Extract error message if available
            const errorMessage = error instanceof Error ? error.message : dictionary.messages.requestError;
            setMagicMessage(errorMessage);
        }
    };

    return (
        <div className={cn("space-y-6", className)}>
            {magicStatus === 'sent' ? (
                // Success state - hide form, show message
                <div className="text-center space-y-4 py-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-success/10 p-3">
                            <svg className="h-8 w-8 text-success" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground">
                            {dictionary.messages.success.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {dictionary.messages.success.description.replace('{email}', magicEmail)}
                        </p>
                    </div>
                </div>
            ) : (
                // Normal form state
                <>
                    {hideGoogle && inAppNotice ? (
                        <div className="space-y-3 rounded-xl border border-border bg-muted p-4 text-left">
                            <p className="text-sm font-semibold text-foreground">{inAppNotice.title}</p>
                            <p className="text-sm text-muted-foreground">{inAppNotice.description}</p>
                            <button
                                type="button"
                                onClick={() => void handleCopyLink()}
                                className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-card text-sm font-medium text-foreground ring-1 ring-inset ring-border"
                            >
                                {linkCopied ? inAppNotice.copied : inAppNotice.copyLink}
                            </button>
                        </div>
                    ) : (
                    <div className="grid gap-4">
                        <button
                            type="button"
                            onClick={() => handleOAuth("google")}
                            disabled={pendingProvider !== null}
                            className={cn(
                                "relative flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-muted px-4 text-sm font-medium text-foreground shadow-sm ring-1 ring-inset ring-border transition-all duration-200 hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                                isModal ? "h-12" : "py-3.5"
                            )}
                        >
                            {pendingProvider === "google" ? <Spinner /> : <GoogleLogo />}
                            <span className="text-base">{dictionary.withGoogle}</span>
                        </button>
                    </div>
                    )}

                    {ENABLE_MAGIC_LINK && (
                        <>
                            {!hideGoogle && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                                    <span className="px-2 text-muted-foreground bg-card">
                                        {dictionary.orDivider}
                                    </span>
                                </div>
                            </div>
                            )}

                            <form onSubmit={handleMagicLink} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="sr-only">{dictionary.emailAddressLabel}</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={magicEmail}
                                        onChange={(e) => setMagicEmail(e.target.value)}
                                        placeholder={dictionary.emailPlaceholder}
                                        className={cn(
                                            "block w-full rounded-xl border-border bg-muted py-3.5 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:border-transparent focus:outline-none transition-all duration-200 focus:ring-primary"
                                        )}
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={magicStatus === "sending"}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center justify-center rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]",
                                        "bg-primary hover:bg-primary/90 shadow-primary/25 focus-visible:outline-primary"
                                    )}
                                >
                                    {magicStatus === "sending" ? (
                                        <div className="flex items-center gap-2">
                                            <Spinner />
                                            <span>{dictionary.sendMagicLink}...</span>
                                        </div>
                                    ) : (
                                        dictionary.sendMagicLink
                                    )}
                                </button>

                                {magicMessage && magicStatus === "error" && (
                                    <p className="text-center text-sm px-4 py-2 rounded-lg animate-fade-in text-error-foreground bg-error/10 border border-error/20">
                                        {magicMessage}
                                    </p>
                                )}
                            </form>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
