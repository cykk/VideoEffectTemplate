"use client";

import { Footer } from "./footer";
import { useLocale } from "@/hooks";
import { usePathname } from "next/navigation";
import { locales } from "@markless/shared/src/i18n/types";

const localePattern = new RegExp(`^/(${locales.join("|")})($|/)`);

export function FooterWrapper() {
    const pathname = usePathname();
    const { locale, dictionary } = useLocale();

    const isAuthPage = pathname.includes("/login") || pathname.includes("/signup") || pathname.startsWith("/redeem");

    const cleanPath = pathname.replace(localePattern, "/");
    const isAppPage =
        cleanPath.startsWith("/dashboard") ||
        cleanPath.startsWith("/settings") ||
        cleanPath.startsWith("/profile") ||
        cleanPath.startsWith("/admin") ||
        cleanPath.startsWith("/transcriptions/") ||
        cleanPath.startsWith("/share/");

    if (isAuthPage || isAppPage) {
        return null;
    }

    return (
        <Footer
            dictionary={dictionary.footer}
            brandDictionary={dictionary.component.layout.footer}
            toolsMenu={dictionary.header.toolsMenu}
            currentLocale={locale}
            activePathname={pathname}
        />
    );
}
