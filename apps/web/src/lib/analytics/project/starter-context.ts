"use client";

import { getLocaleFromPathname } from "@markless/shared/src/i18n/locale-config";

export type StarterPageType =
    | "home"
    | "pricing"
    | "payment_success"
    | "membership"
    | "other";

export interface StarterAnalyticsContext {
    locale: string;
    normalizedPath: string;
    pageType: StarterPageType;
    sourcePage: StarterPageType;
}

export function normalizeStarterPathname(pathname: string | null) {
    if (!pathname) {
        return "/";
    }

    const normalizedLocale = getLocaleFromPathname(pathname);
    const prefix = normalizedLocale === "en" ? "" : `/${normalizedLocale}`;
    const withoutLocale = prefix && pathname.startsWith(prefix)
        ? pathname.slice(prefix.length) || "/"
        : pathname;

    return withoutLocale === "" ? "/" : withoutLocale;
}

export function resolveStarterAnalyticsContext(pathname: string | null): StarterAnalyticsContext {
    const locale = getLocaleFromPathname(pathname);
    const normalizedPath = normalizeStarterPathname(pathname);

    let pageType: StarterPageType = "other";
    if (normalizedPath === "/") {
        pageType = "home";
    } else if (normalizedPath === "/pricing") {
        pageType = "pricing";
    } else if (normalizedPath === "/payment/success") {
        pageType = "payment_success";
    } else if (normalizedPath.startsWith("/settings")) {
        pageType = "membership";
    }

    return {
        locale,
        normalizedPath,
        pageType,
        sourcePage: pageType,
    };
}

export function resolveCurrentStarterAnalyticsContext() {
    if (typeof window === "undefined") {
        return null;
    }

    const context = resolveStarterAnalyticsContext(window.location.pathname);

    return {
        locale: context.locale,
        page_type: context.pageType,
        source_page: context.sourcePage,
    };
}
