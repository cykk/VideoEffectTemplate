"use client";

import { Sparkles, Wallet, Layers3, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { formatAppNumber } from "@/lib/formatters";

interface SubscriptionUpgradeSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  interval: "month" | "year";
  totalCredits: number;
  grantedCredits: number;
  carriedOverCredits: number;
}

export interface SubscriptionUpgradeSuccessSummary {
  planName: string;
  interval: "month" | "year";
  totalCredits: number;
  grantedCredits: number;
  carriedOverCredits: number;
}

export function SubscriptionUpgradeSuccessModal({
  open,
  onOpenChange,
  planName,
  interval,
  totalCredits,
  grantedCredits,
  carriedOverCredits,
}: SubscriptionUpgradeSuccessModalProps) {
  const { dictionary, locale } = useLocale();
  const dict = dictionary.pages.pricing.upgradeSuccessModal;
  const intervalLabel =
    interval === "year" ? dict.interval.yearly : dict.interval.monthly;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10030]"
        className="z-[10031] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">{dict.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {dict.description
            .replace("{tierName}", planName)
            .replace("{interval}", intervalLabel)}
        </DialogDescription>

        <div className="border-b border-slate-100 px-6 pb-5 pt-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {dict.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {dict.description
              .replace("{tierName}", planName)
              .replace("{interval}", intervalLabel)}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-center">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-primary/80">
              {dict.creditBalance.title}
            </div>
            <div className="mt-2 text-4xl font-bold text-slate-900">
              {formatAppNumber(totalCredits, locale)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {dict.creditBalance.credits}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Wallet className="size-4" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {dict.creditBalance.remaining
                    .replace("${credits}", "")
                    .trim()}
                </span>
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {formatAppNumber(carriedOverCredits, locale)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Sparkles className="size-4" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {dict.creditBalance.new.replace("${credits}", "").trim()}
                </span>
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {formatAppNumber(grantedCredits, locale)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Layers3 className="size-4" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {dict.creditBalance.title}
                </span>
              </div>
              <div className="text-lg font-semibold text-slate-900">
                {formatAppNumber(totalCredits, locale)}
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full cursor-pointer rounded-xl bg-primary text-white hover:bg-primary/90"
          >
            {dict.cta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
