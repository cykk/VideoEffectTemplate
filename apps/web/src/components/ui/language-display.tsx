import { cn } from "@markless/shared/src/lib/utils";

export function shouldShowDistinctNativeLabel(
  label: string,
  nativeLabel: string
): boolean {
  const trimmedNative = nativeLabel.trim();
  if (!trimmedNative) {
    return false;
  }

  return label.trim().toLowerCase() !== trimmedNative.toLowerCase();
}

export function formatLanguageAccessibleLabel(
  label: string,
  nativeLabel: string
): string {
  if (!shouldShowDistinctNativeLabel(label, nativeLabel)) {
    return label;
  }

  return `${label}, ${nativeLabel}`;
}

type LanguageDisplayProps = {
  label: string;
  nativeLabel: string;
  className?: string;
};

/** Dropdown list item: label + nativeLabel stacked vertically */
export function LanguageOptionDisplay({
  label,
  nativeLabel,
  singleLine = false,
  className,
}: LanguageDisplayProps & { singleLine?: boolean }) {
  if (singleLine || !shouldShowDistinctNativeLabel(label, nativeLabel)) {
    return (
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium leading-tight text-slate-700",
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start gap-0.5 overflow-hidden text-left",
        className
      )}
    >
      <span className="w-full truncate text-sm font-medium leading-tight text-slate-700">
        {label}
      </span>
      <span className="w-full truncate text-xs leading-tight text-slate-500">
        {nativeLabel}
      </span>
    </span>
  );
}

/** Selected state: inline label ? nativeLabel; compact shows label only */
export function LanguageSelectedDisplay({
  label,
  nativeLabel,
  mode = "inline",
  className,
}: LanguageDisplayProps & { mode?: "inline" | "compact" }) {
  if (mode === "compact" || !shouldShowDistinctNativeLabel(label, nativeLabel)) {
    return (
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium text-slate-900",
          className
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "min-w-0 flex-1 truncate text-sm font-medium text-slate-900",
        className
      )}
    >
      <span>{label}</span>
      <span className="text-slate-300" aria-hidden="true">
        {" \u00b7 "}
      </span>
      <span className="text-slate-500">{nativeLabel}</span>
    </span>
  );
}
