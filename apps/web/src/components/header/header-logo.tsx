"use client";

import Link from "next/link";

import { BrandWordmark } from "@/components/ui/logo";

interface HeaderLogoProps {
    locale: string;
    href?: string;
    variant?: "dark" | "light";
    hideTextOnMobile?: boolean;
    textSize?: "sm" | "md";
    brandName: string;
    homeAriaLabel: string;
    supportLabel?: string;
}

export function HeaderLogo({
    locale,
    variant = "dark",
    hideTextOnMobile = true,
    textSize = "md",
    href: customHref,
    brandName,
    homeAriaLabel,
    supportLabel,
}: HeaderLogoProps) {
    const href = customHref ?? (locale === "en" ? "/" : `/${locale}`);

    return (
        <div className="flex items-center shrink-0">
            <Link
                href={href}
                className="transition-all duration-300 group cursor-pointer"
                suppressHydrationWarning
                aria-label={homeAriaLabel}
            >
                <BrandWordmark
                    brandName={brandName}
                    supportLabel={supportLabel}
                    variant={variant}
                    textSize={textSize}
                    hideOnMobile={hideTextOnMobile}
                />
            </Link>
        </div>
    );
}
