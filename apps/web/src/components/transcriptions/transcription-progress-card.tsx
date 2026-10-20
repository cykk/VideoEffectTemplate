import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type TranscriptionProgressCardProps = {
  label: string;
  progressValue: number;
  recovery?: {
    description: string;
    statusMessage: string | null;
    checkLabel: string;
    checkAgainLabel: string;
    hasCheckedOnce: boolean;
    isChecking: boolean;
    isCoolingDown: boolean;
    onCheck: () => void;
  };
};

export function TranscriptionProgressCard({
  label,
  progressValue,
  recovery,
}: TranscriptionProgressCardProps) {
  const recoveryActionLabel = recovery
    ? recovery.hasCheckedOnce
      ? recovery.checkAgainLabel
      : recovery.checkLabel
    : "";

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {progressValue}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${progressValue}%` }}
        />
      </div>
      {recovery ? (
        <div
          className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2.5"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="min-w-0 flex-1 text-sm text-amber-950">
              {recovery.statusMessage ?? recovery.description}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-300 bg-white/90 text-amber-950 hover:bg-white hover:text-amber-950"
              onClick={recovery.onCheck}
              disabled={recovery.isChecking || recovery.isCoolingDown}
              aria-busy={recovery.isChecking}
              aria-label={recoveryActionLabel}
            >
              {recovery.isChecking ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              )}
              {recoveryActionLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
