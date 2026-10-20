"use client";

import { cn } from "@markless/shared/src/lib/utils";
import { formatUsdPrice, type PricingDisplayValues } from "@markless/shared/src/lib/pricing/display-plans";

interface PricingPriceDisplayProps {
  pricing: PricingDisplayValues;
  freeNote?: string;
  className?: string;
}

export function PricingPriceDisplay({
  pricing,
  freeNote,
  className,
}: PricingPriceDisplayProps) {
  const showOriginal =
    !pricing.unavailable &&
    typeof pricing.originalAmount === "number" &&
    pricing.originalAmount > pricing.amount;

  if (pricing.unavailable) {
    return (
      <div className={cn("py-5 text-center", className)}>
        <p className="text-sm leading-relaxed text-slate-500">{pricing.billingNote}</p>
      </div>
    );
  }

  return (
    <div className={cn("py-5 text-center", className)}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
        <span className="text-4xl font-bold tracking-tight text-slate-900">
          {formatUsdPrice(pricing.amount)}
        </span>
        <span className="text-base font-medium text-slate-500">
          {pricing.periodSuffix}
        </span>
        {showOriginal ? (
          <span className="text-lg font-medium text-slate-400 line-through">
            {formatUsdPrice(pricing.originalAmount!)}
          </span>
        ) : null}
      </div>
      {pricing.billingNote ? (
        <p className="mt-2 text-sm text-slate-500">{pricing.billingNote}</p>
      ) : null}
      {freeNote ? (
        <p className="mt-2 text-sm text-slate-500">{freeNote}</p>
      ) : null}
    </div>
  );
}
