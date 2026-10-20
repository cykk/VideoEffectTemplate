"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AuthModalDictionary } from "@markless/shared/src/i18n/types";
import { AuthForm } from "@/components/auth/auth-form";
import { cn } from "@markless/shared/src/lib/utils";
import { formatFreeTierCopy } from "@markless/shared/src/lib/marketing/free-tier-copy";

type GuestLimitAuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "signin" | "signup";
  onModeChange?: (mode: "signin" | "signup") => void;
  dictionary: AuthModalDictionary;
  freeTierValues: {
    guestDailyLimit: number;
    guestDurationLimitMinutes: number;
    authenticatedDailyLimit: number;
    authenticatedDurationLimitMinutes: number;
  };
};

function formatTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

type ComparisonCardProps = {
  label: string;
  dailyCount: number;
  durationMinutes: number;
  dailyLimitLine: string;
  durationLimitLine: string;
  variant: "guest" | "free";
};

function ComparisonCard({
  label,
  dailyCount,
  durationMinutes,
  dailyLimitLine,
  durationLimitLine,
  variant,
}: ComparisonCardProps) {
  const isFree = variant === "free";

  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-xl border px-5 py-5 sm:px-5 sm:py-5",
        isFree
          ? "border-brand-200 bg-brand-50/80 ring-1 ring-brand-100"
          : "border-slate-200 bg-white"
      )}
    >
      <p
        className={cn(
          "mb-4 truncate text-xs font-semibold tracking-wide",
          isFree ? "text-primary" : "text-slate-500"
        )}
      >
        {label}
      </p>
      <ul className="space-y-3">
        <li
          className={cn(
            "text-sm leading-relaxed",
            isFree ? "font-semibold text-primary" : "font-medium text-slate-700"
          )}
        >
          {formatTemplate(dailyLimitLine, { count: dailyCount })}
        </li>
        <li
          className={cn(
            "text-sm leading-relaxed",
            isFree ? "font-semibold text-primary" : "font-medium text-slate-700"
          )}
        >
          {formatTemplate(durationLimitLine, { minutes: durationMinutes })}
        </li>
      </ul>
    </div>
  );
}

export function GuestLimitAuthModal({
  open,
  onOpenChange,
  mode = "signup",
  onModeChange,
  dictionary,
  freeTierValues,
}: GuestLimitAuthModalProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const guestLimitDict = dictionary.guestLimit;
  const comparisonDict = guestLimitDict.comparison;

  const headerCopy =
    mode === "signup"
      ? {
          title: guestLimitDict.title,
        }
      : {
          title: dictionary.signin.title,
          subtitle: dictionary.signin.description,
        };

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setIsSuccess(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    setIsSuccess(false);
  }, [mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10020]"
        className="z-[10021] animate-fade-in gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-2xl sm:max-w-[520px]"
      >
        <DialogTitle className="sr-only">{headerCopy.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {"subtitle" in headerCopy ? headerCopy.subtitle : headerCopy.title}
        </DialogDescription>

        <div
          className={cn(
            isSuccess
              ? "px-8 py-12 sm:px-10"
              : "flex flex-col gap-8 px-8 py-10 sm:px-10 sm:py-11"
          )}
        >
          {!isSuccess ? (
            <>
              <header className="space-y-2 px-1 text-center">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                  {headerCopy.title}
                </h2>
              </header>

              {mode === "signup" ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
                  <ComparisonCard
                    label={comparisonDict.guestLabel}
                    dailyCount={freeTierValues.guestDailyLimit}
                    durationMinutes={freeTierValues.guestDurationLimitMinutes}
                    dailyLimitLine={comparisonDict.dailyLimitLine}
                    durationLimitLine={comparisonDict.durationLimitLine}
                    variant="guest"
                  />
                  <ArrowRight
                    className="size-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <ComparisonCard
                    label={comparisonDict.freeAccountLabel}
                    dailyCount={freeTierValues.authenticatedDailyLimit}
                    durationMinutes={freeTierValues.authenticatedDurationLimitMinutes}
                    dailyLimitLine={comparisonDict.dailyLimitLine}
                    durationLimitLine={comparisonDict.durationLimitLine}
                    variant="free"
                  />
                </div>
              ) : (
                <p className="text-center text-sm leading-relaxed text-slate-500">
                  {formatFreeTierCopy(dictionary.signup.fallbackDescription, {
                    authenticatedDailyLimit: freeTierValues.authenticatedDailyLimit,
                    authenticatedDurationLimitMinutes:
                      freeTierValues.authenticatedDurationLimitMinutes,
                  })}
                </p>
              )}
            </>
          ) : null}

          <AuthForm
            dictionary={dictionary}
            isModal={true}
            mode={mode}
            className="space-y-0 pt-1"
            onSuccess={() => {
              setIsSuccess(true);
            }}
          />

          {!isSuccess ? (
            <div className="border-t border-slate-100 pt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  {dictionary.modeSwitch.noAccount}{" "}
                  <button
                    type="button"
                    onClick={() => onModeChange?.("signup")}
                    className="cursor-pointer p-2 -m-2 inline-block font-medium text-primary hover:underline"
                  >
                    {dictionary.modeSwitch.signUp}
                  </button>
                </>
              ) : (
                <>
                  {dictionary.modeSwitch.hasAccount}{" "}
                  <button
                    type="button"
                    onClick={() => onModeChange?.("signin")}
                    className="cursor-pointer p-2 -m-2 inline-block font-medium text-primary hover:underline"
                  >
                    {dictionary.modeSwitch.logIn}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
