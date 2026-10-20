"use client";

import type { ReactNode } from "react";
import { cn } from "@markless/shared/src/lib/utils";

type PlanUsageMetricRowProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  used?: number;
  total?: number;
  footer?: ReactNode;
  className?: string;
};

export function PlanUsageMetricRow({
  icon,
  label,
  value,
  used,
  total,
  footer,
  className,
}: PlanUsageMetricRowProps) {
  const showProgress =
    typeof used === "number" && typeof total === "number" && total > 0;
  const percent = showProgress
    ? Math.min(100, Math.round((used / total) * 100))
    : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {icon}
          </span>
          <span className="text-sm font-medium text-slate-700">
            {label}
          </span>
        </div>
        <div className="shrink-0 text-sm font-medium tabular-nums text-slate-700">{value}</div>
      </div>

      {showProgress ? (
        <div
          className="ml-6 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {footer ? <div className="ml-6">{footer}</div> : null}
    </div>
  );
}

export function PlanUsageFractionValue({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const visibleUsed = Math.min(Math.max(0, used), total);

  return (
    <>
      <span className="text-slate-700">{visibleUsed}</span>
      <span className="text-slate-400">/{total}</span>
    </>
  );
}
