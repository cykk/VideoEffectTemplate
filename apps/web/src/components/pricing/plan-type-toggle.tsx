"use client";

import { cn } from "@markless/shared/src/lib/utils";
import { useLocale } from "@/hooks/use-locale";

export type PlanType = 'subscription' | 'credits';

interface PlanTypeToggleProps {
  planType: PlanType;
  onPlanTypeChange: (type: PlanType) => void;
  className?: string;
}

export function PlanTypeToggle({
  planType,
  onPlanTypeChange,
  className
}: PlanTypeToggleProps) {
  const { dictionary } = useLocale();
  const dict = dictionary?.pages?.pricing?.planTypeToggle;
  
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="inline-flex items-center gap-2 p-1 bg-slate-50/50 backdrop-blur-sm rounded-xl border border-neutral-800">
        <button
          onClick={() => onPlanTypeChange('subscription')}
          className={cn(
            "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            planType === 'subscription'
              ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30"
              : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          {dict?.subscriptionPlans ?? ""}
        </button>
        <button
          onClick={() => onPlanTypeChange('credits')}
          className={cn(
            "px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            planType === 'credits'
              ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30"
              : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          {dict?.creditPacks ?? ""}
        </button>
      </div>
    </div>
  );
}
