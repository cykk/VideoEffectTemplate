import * as React from "react";
import { BRAND_CONFIG } from "@markless/shared/src/lib/config/brand";
import { cn } from "@markless/shared/src/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  showText?: boolean;
}

interface BrandWordmarkProps {
  brandName: string;
  supportLabel?: string;
  variant?: "dark" | "light";
  textSize?: "sm" | "md";
  className?: string;
  hideOnMobile?: boolean;
}

/** 进化版 Mark：左侧节奏音轨 → 右侧文本线，象征音频转文本（用于 favicon 等场景） */
export function LogoMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="13" width="2.5" height="5" rx="1.25" fill="currentColor" />
      <rect x="7.5" y="7" width="2.5" height="16" rx="1.25" fill="currentColor" />
      <rect x="11.5" y="10" width="2.5" height="10" rx="1.25" fill="currentColor" />
      <rect x="18.5" y="10" width="7" height="2.5" rx="1.25" fill="currentColor" />
      <rect x="18.5" y="15.5" width="5" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  );
}

/** 方案 U1：MP3ToText.io 统一 brand-700 实色 */
export function BrandWordmark({
  brandName,
  supportLabel,
  variant = "dark",
  textSize = "md",
  className,
  hideOnMobile = false,
}: BrandWordmarkProps) {
  const wordmarkColor = variant === "light" ? "text-brand-100" : "text-brand-700";

  return (
    <span
      translate="no"
      className={cn(
        "notranslate font-semibold tracking-normal",
        textSize === "sm" ? "text-xl" : "text-2xl",
        hideOnMobile && "hidden sm:inline",
        wordmarkColor,
        className
      )}
    >
      {brandName}
      {supportLabel}
    </span>
  );
}

export function LogoWordmark({ className = "", variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  return (
    <BrandWordmark
      brandName={BRAND_CONFIG.primaryName}
      supportLabel={BRAND_CONFIG.wordmarkSuffix}
      variant={variant}
      textSize="sm"
      className={cn("text-xl font-bold tracking-tight", className)}
    />
  );
}

export function Logo({ className = "", showText = true, ...props }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="flex-shrink-0 text-brand-600" {...props} />
      {showText ? <LogoWordmark /> : null}
    </div>
  );
}
