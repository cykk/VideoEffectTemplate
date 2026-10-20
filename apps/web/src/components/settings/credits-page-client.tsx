"use client";

import Link from "next/link";
import { Sparkles, Clock, Plus, Minus, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditsRechargeButton } from "@/components/settings/credits-recharge-button";
import { useApiResource } from "@/hooks/use-api-resource";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@markless/shared/src/i18n/types";
import { formatAppDateTime, formatAppNumber } from "@/lib/formatters";

type CreditsHistoryData = {
  balance: {
    total: number;
    plan: number;
    pack: number;
    bonus: number;
  };
  history: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    description: string;
  }>;
};

export function CreditsPageClient({ locale }: { locale: Locale }) {
  const { dictionary } = useLocale();
  const dict = dictionary.pages.membership.page.creditsTab;
  const { data } = useApiResource<CreditsHistoryData>("/api/user/credits/history");
  const descriptionDict = dict.history.descriptions;

  const resolveHistoryDescription = (description: string) => {
    switch (description) {
      case "TASK_FAILED_REFUNDED":
      case "Task failed �C credits refunded":
      case "Task failed - credits refunded":
        return descriptionDict.taskFailedRefunded;
      case "SUBSCRIPTION_CREDITS_EXPIRED":
      case "Subscription credits expired":
        return descriptionDict.subscriptionCreditsExpired;
      case "SUBSCRIPTION_REACTIVATED":
        return descriptionDict.subscriptionReactivated;
      case "SUBSCRIPTION_CREDITS_GRANTED":
        return descriptionDict.subscriptionCreditsGranted;
      case "SUBSCRIPTION_RENEWAL_CREDITS":
        return descriptionDict.subscriptionRenewalCredits;
      case "SUBSCRIPTION_UPGRADE_YEARLY_BONUS":
        return descriptionDict.subscriptionUpgradeYearlyBonus;
      case "SUBSCRIPTION_UPGRADE_MONTHLY_DRIP":
        return descriptionDict.subscriptionUpgradeMonthlyDrip;
      case "SUBSCRIPTION_UPGRADE_DELTA":
        return descriptionDict.subscriptionUpgradeDelta;
      default:
        return description;
    }
  };

  const viewData = data
    ? {
        ...data,
        history: data.history.map((item) => ({
          ...item,
          date: formatAppDateTime(item.date, locale),
          description: resolveHistoryDescription(item.description),
        })),
      }
    : {
        balance: { total: 0, plan: 0, pack: 0, bonus: 0 },
        history: [] as CreditsHistoryData["history"],
      };

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">{dict.title}</h1>
        <p className="text-base text-slate-500">{dict.description}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{dict.appsumo.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{dict.appsumo.description}</p>
          </div>
          <Button asChild variant="outline" className="min-h-11 shrink-0">
            <Link href="/redeem">{dict.appsumo.cta}</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-slate-100">
                <Sparkles className="w-5 h-5 text-slate-700" />
              </div>
              <span className="text-sm font-medium text-slate-500">{dict.balance.total}</span>
            </div>
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-3xl font-bold text-foreground">{formatAppNumber(viewData.balance.total, locale)}</span>
              <CreditsRechargeButton locale={locale} />
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-4 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-200 lg:pl-8">
            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{dict.balance.plan}</div>
              <div className="text-xl font-semibold text-foreground">{formatAppNumber(viewData.balance.plan, locale)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{dict.balance.pack}</div>
              <div className="text-xl font-semibold text-foreground">{formatAppNumber(viewData.balance.pack, locale)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{dict.balance.bonus}</div>
              <div className="text-xl font-semibold text-foreground">{formatAppNumber(viewData.balance.bonus, locale)}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {dict.history.title}
        </h2>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {viewData.history.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {viewData.history.map((record) => {
                const isCredit = record.amount > 0;

                return (
                  <div key={record.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isCredit ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          }`}
                        >
                          {isCredit ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">{record.description}</div>
                          <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{record.date}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="capitalize">{record.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className={`text-lg font-semibold shrink-0 ${isCredit ? "text-emerald-600" : "text-amber-600"}`}>
                        {isCredit ? "+" : ""}
                        {record.amount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{dict.history.empty}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-400">
                <Zap className="w-4 h-4" />
                <span>{dict.history.hint}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

