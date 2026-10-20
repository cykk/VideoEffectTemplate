"use client";

import { Info } from "lucide-react";
import { cn } from "@markless/shared/src/lib/utils";

type PlanUsageHoverHintProps = {
  ariaLabel: string;
  tooltip: string;
  variant: "plan-reset" | "pack-expiry";
  className?: string;
};

const variantClasses = {
  "plan-reset": {
    group: "group/plan-reset",
    hover: "group-hover/plan-reset:block",
  },
  "pack-expiry": {
    group: "group/pack-expiry",
    hover: "group-hover/pack-expiry:block",
  },
} as const;

export function PlanUsageHoverHint({
  ariaLabel,
  tooltip,
  variant,
  className,
}: PlanUsageHoverHintProps) {
  const { group, hover } = variantClasses[variant];

  return (
    <span className={cn("relative inline-flex", group, className)}>
      <Info
        className="size-3.5 shrink-0 text-slate-400"
        aria-label={ariaLabel}
      />
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full right-0 z-50 mt-1 hidden w-max whitespace-nowrap rounded-md border border-slate-200/80 bg-white/95 px-2.5 py-1 text-xs font-normal text-slate-600 shadow-sm backdrop-blur-sm",
          hover
        )}
      >
        {tooltip}
      </div>
    </span>
  );
}
