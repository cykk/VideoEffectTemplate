import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@markless/server/src/lib/db/client";
import {
    sendMagicLinkEmail,
    isConfigured as isZeptoMailConfigured
} from "@markless/server/src/lib/email/zeptomail";
import { checkMagicLinkRateLimit, formatResetTime } from "@markless/server/src/lib/auth/rate-limit";
import { BRAND_CONFIG } from "@markless/shared/src/lib/config/brand";
import { getWebBaseUrl } from "@markless/shared/src/lib/config/urls";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { bindFirstTouch, getRequestFromAuthContext, parseFirstTouch, FIRST_TOUCH_COOKIE } from "@markless/server/src/lib/attribution/first-touch";

function normalizeOrigin(value?: string): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function isIpAddress(hostname: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function resolveCookieDomain(): string | undefined {
    const configured = getEnv("AUTH_COOKIE_DOMAIN");
    if (configured) {
        return configured.replace(/^\./, "");
    }

    try {
        const webUrl = new URL(getWebBaseUrl());
        const hostname = webUrl.hostname;
        if (hostname === "localhost" || isIpAddress(hostname)) {
            return undefined;
        }

        const parts = hostname.split(".");
        if (parts.length < 2) {
            return undefined;
        }

        return parts.slice(-2).join(".");
    } catch {
        return undefined;
    }
}

function resolveTrustedOrigins(): string[] {
    const configured = (getEnv("BETTER_AUTH_TRUSTED_ORIGINS") || "")
        .split(",")
        .map((value) => normalizeOrigin(value.trim()))
        .filter((value): value is string => Boolean(value));

    const defaults = [
        normalizeOrigin(getWebBaseUrl()),
        normalizeOrigin(getEnv("NEXT_PUBLIC_WEB_URL")),
        normalizeOrigin(getEnv("NEXT_PUBLIC_APP_URL")),
        normalizeOrigin(getEnv("NEXT_PUBLIC_AUTH_BASE_URL")),
    ].filter((value): value is string => Boolean(value));

    return Array.from(new Set([...defaults, ...configured]));
}

// Auth server base URL priority:
// 1. BETTER_AUTH_URL       — explicit override (legacy / separate auth domain)
// 2. NEXT_PUBLIC_APP_URL   — backend anchor (recommended, covers most setups)
// 3. getWebBaseUrl()       — fallback to web URL (single-domain where frontend = backend)
const appBaseURL =
    getEnv("BETTER_AUTH_URL") ??
    getEnv("NEXT_PUBLIC_APP_URL") ??
    getWebBaseUrl();

const cookieDomain = resolveCookieDomain();
const trustedOrigins = resolveTrustedOrigins();

const googleClientId = getEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET");
const facebookClientId = getEnv("FACEBOOK_CLIENT_ID");
const facebookClientSecret = getEnv("FACEBOOK_CLIENT_SECRET");

const socialProviders = {
    ...(googleClientId && googleClientSecret
        ? {
            google: {
                clientId: googleClientId,
                clientSecret: googleClientSecret,
            },
        }
        : {}),
    ...(facebookClientId && facebookClientSecret
        ? {
            facebook: {
                clientId: facebookClientId,
                clientSecret: facebookClientSecret,
            },
        }
        : {}),
} satisfies NonNullable<
    NonNullable<Parameters<typeof betterAuth>[0]>["socialProviders"]
>;

if (Object.keys(socialProviders).length === 0) {
    console.warn(
        "[Better Auth] No social providers configured. Set GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET to enable OAuth sign-in.",
    );
}

export const auth = betterAuth({
    appName: BRAND_CONFIG.primaryName,
    baseURL: appBaseURL,
    basePath: "/api/auth",
    secret: getEnv("BETTER_AUTH_SECRET"),
    trustedOrigins,
    advanced: cookieDomain
        ? {
            crossSubDomainCookies: {
                enabled: true,
                domain: cookieDomain,
            },
        }
        : undefined,
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    databaseHooks: {
        user: {
            create: {
                after: async (user, context) => {
                    try {
                        const request = getRequestFromAuthContext(context);
                        const touch = request ? parseFirstTouch(request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${FIRST_TOUCH_COOKIE}=([^;]*)`))?.[1]) : null;
                        await bindFirstTouch(user.id, touch);
                    } catch (error) {
                        console.error("[Attribution] Failed to bind first touch", error);
                    }
                },
            },
        },
    },
    socialProviders,
    plugins: [
        magicLink({
            // Security: 15 minutes expiration (OWASP recommended: 10-30 minutes)
            expiresIn: 900, // 15 minutes in seconds

            sendMagicLink: async ({ email, url }) => {
                // Rate limiting: Prevent abuse (5 requests per hour)
                const rateLimitResult = await checkMagicLinkRateLimit(email);

                if (!rateLimitResult.success) {
                    const resetTime = formatResetTime(rateLimitResult.reset);
                    const errorMessage = `Too many magic link requests. Please try again in ${resetTime}.`;

                    console.warn(`[Better Auth] ⛔ Rate limit exceeded for ${email}`);
                    throw new Error(errorMessage);
                }

                // Email service check
                if (isZeptoMailConfigured()) {
                    try {
                        await sendMagicLinkEmail(email, url);
                        console.log(`[Better Auth] ✅ Magic link sent to ${email} via ZeptoMail (${rateLimitResult.remaining} requests remaining)`);
                    } catch (error) {
                        console.error('[Better Auth] ❌ Failed to send magic link email:', error);
                        throw error;
                    }
                } else {
                    console.error('[Better Auth] ❌ ZeptoMail is not configured. Please set ZEPTOMAIL_API_KEY and ZEPTOMAIL_FROM_EMAIL.');
                    throw new Error('Email service not configured');
                }
            },
        }),
    ],
});
