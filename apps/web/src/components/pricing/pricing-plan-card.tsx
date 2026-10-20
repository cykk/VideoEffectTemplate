"use client";

import type { MouseEvent } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import { PricingPriceDisplay } from "@/components/pricing/pricing-price-display";
import type { PricingDisplayValues } from "@markless/shared/src/lib/pricing/display-plans";

interface PricingPlanCardProps {
  name: string;
  description: string;
  features: string[];
  pricing: PricingDisplayValues;
  freeNote?: string;
  ctaLabel: string;
  processingLabel?: string;
  popularLabel?: string;
  popular?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  isCurrentPlan?: boolean;
  isLoading?: boolean;
  onCtaClick?: () => void;
  onCtaNavigate?: () => void;
  ctaHref?: string;
  checkoutDisabled?: boolean;
  className?: string;
}

export function PricingPlanCard({
  name,
  description,
  features = [],
  pricing,
  freeNote,
  ctaLabel,
  processingLabel,
  popularLabel,
  popular = false,
  isSelected = false,
  onSelect,
  isCurrentPlan = false,
  isLoading = false,
  onCtaClick,
  onCtaNavigate,
  ctaHref,
  checkoutDisabled = false,
  className,
}: PricingPlanCardProps) {
  const isPrimaryCta = popular && !isCurrentPlan && !checkoutDisabled;
  const isCtaDisabled = isLoading || isCurrentPlan || checkoutDisabled;
  const handleCtaClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCtaClick?.();
  };

  const ctaClassName = cn(
    "h-11 w-full rounded-lg text-sm font-semibold transition-colors duration-200",
    isCurrentPlan &&
      "cursor-default border border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-500",
    !isCurrentPlan &&
      isPrimaryCta &&
      "bg-primary text-white shadow-sm hover:bg-primary/90",
    !isCurrentPlan &&
      !isPrimaryCta &&
      !checkoutDisabled &&
      cn(
        "border border-slate-300 bg-white text-slate-900 shadow-none",
        "group-hover:border-primary group-hover:bg-primary/5 group-hover:text-primary",
        "hover:border-primary hover:bg-primary/5 hover:text-primary"
      ),
    checkoutDisabled &&
      "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-400 group-hover:border-slate-200 group-hover:bg-slate-100 group-hover:text-slate-400"
  );

  const ctaButton = (
    <Button
      type="button"
      className={ctaClassName}
      onClick={handleCtaClick}
      disabled={isCtaDisabled}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          {processingLabel ?? ctaLabel}
        </>
      ) : (
        ctaLabel
      )}
    </Button>
  );

  return (
    <div className={cn("relative h-full", popular && "mt-3")}>
      {popular && popularLabel ? (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white bg-primary px-3.5 py-1 text-xs font-semibold text-white shadow-sm">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {popularLabel}
          </span>
        </div>
      ) : null}

      <div
      onClick={onSelect}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-200",
        isSelected
          ? "border-2 border-primary bg-white"
          : "border-2 border-slate-200 hover:border-slate-300 hover:shadow-md",
        className
      )}
    >
      <div className="mb-5 text-center">
        <h3 className="text-2xl font-bold text-slate-900">{name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>

      <div className="mb-5" onClick={(event) => event.stopPropagation()}>
        {ctaHref && !isCurrentPlan ? (
          <Button asChild className={ctaClassName}>
            <Link href={ctaHref} onClick={onCtaNavigate}>{ctaLabel}</Link>
          </Button>
        ) : (
          ctaButton
        )}
      </div>

      <PricingPriceDisplay pricing={pricing} freeNote={freeNote} className="py-4" />

      <ul className="mt-2 flex-1 space-y-3 text-left">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-sm leading-relaxed text-slate-600">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
