"use client";

import type { ReactNode } from "react";
import { cn } from "@markless/shared/src/lib/utils";

type PlanUsageProgressProps = {
  label: string;
  used: number;
  total: number;
  className?: string;
  labelSuffix?: ReactNode;
};

export function PlanUsageProgress({
  label,
  used,
  total,
  className,
  labelSuffix,
}: PlanUsageProgressProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((used / safeTotal) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-visible flex items-center gap-1.5">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {labelSuffix}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{percent}%</span>
      </div>
    </div>
  );
}
