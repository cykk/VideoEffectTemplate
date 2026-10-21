"use client";

import Link from "next/link";
import { Crown, AlertTriangle } from "lucide-react";
import { SubscriptionActions } from "@/components/settings/subscription/subscription-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubscriptionUpgradeButton } from "@/components/settings/subscription-upgrade-button";
import { ResumeSubscriptionButton } from "@/components/settings/subscription/resume-subscription-button";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { useApiResource } from "@/hooks/use-api-resource";
import { useLocale } from "@/hooks/use-locale";
import { defaultLocale } from "@markless/shared/src/i18n";
import { usePublicBrand } from "@/components/providers/public-brand-provider";
import type { Locale } from "@markless/shared/src/i18n/types";
import { formatAppCurrency, formatAppDate, formatAppNumber } from "@/lib/formatters";
import { WaffoManagement } from "./subscription/waffo-management";

type SubscriptionDetailData = {
  subscription: {
    planName: string;
    provider?: string;
    planId?: string;
    scheduledPlanId?: string | null;
    status: string;
    interval: string;
    currentPeriodEnd: string | null;
    creditsPerPeriod: number;
    price: number;
    cancelAtPeriodEnd: number;
  } | null;
};

export function SubscriptionPageClient({ locale }: { locale: Locale }) {
  const { supportEmail } = usePublicBrand();
  const { dictionary } = useLocale();
  const dict = dictionary.pages.membership.subscriptionPage;
  const { data } = useApiResource<SubscriptionDetailData>("/api/user/subscription/detail");
  const subscription = data?.subscription ?? null;

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-2xl font-bold mb-4">{dict.emptyState.title}</h2>
        <p className="text-neutral-500 mb-8">{dict.emptyState.description}</p>
        <Link href={locale === defaultLocale ? "/pricing" : `/${locale}/pricing`}>
          <Button>{dict.emptyState.cta}</Button>
        </Link>
      </div>
    );
  }

  const isCancelScheduled = subscription.cancelAtPeriodEnd === 1;
  const isActive = subscription.status === SUBSCRIPTION_STATUS.ACTIVE;
  const statusLabel = isCancelScheduled ? dict.status.canceled : dict.status.active;
  const statusColor = isCancelScheduled
    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
    : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  const periodEndDate = subscription.currentPeriodEnd
    ? formatAppDate(subscription.currentPeriodEnd, locale)
    : "-";
  const intervalLabel = subscription.interval === "year" ? dict.details.interval.year : dict.details.interval.month;

  return (
    <div>
      {isCancelScheduled && (
        <div className="mb-6">
          <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
            <AlertTitle className="mb-1 font-bold text-amber-800 dark:text-amber-300">{dict.cancelAlert.title}</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-medium !text-amber-800 dark:!text-amber-200">
              <span>{dict.cancelAlert.description.replace("{date}", periodEndDate)}</span>
              <div className="shrink-0">
                <ResumeSubscriptionButton locale={locale} variant="alert" />
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{dict.header.title}</h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400">{dict.header.description}</p>
      </div>
      {subscription.provider === 'waffo' && <WaffoManagement currentPlan={subscription.planId || ''} scheduled={Boolean(subscription.scheduledPlanId)} />}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${isActive ? "bg-purple-50 dark:bg-purple-900/20" : "bg-neutral-100 dark:bg-neutral-800"}`}>
              <Crown className={`w-8 h-8 ${isActive ? "text-purple-600 dark:text-purple-400" : "text-neutral-500 dark:text-neutral-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{subscription.planName}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>{statusLabel}</span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400">
                {formatAppCurrency(subscription.price, "USD", locale)} / {intervalLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {isActive && <SubscriptionUpgradeButton locale={locale} />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-neutral-100 dark:border-neutral-900">
          <div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              {isCancelScheduled ? dict.details.accessExpiresOn : dict.details.nextBillingDate}
            </div>
            <div className={`text-base font-medium ${isCancelScheduled ? "text-amber-600 dark:text-amber-500" : "text-neutral-900 dark:text-neutral-100"}`}>
              {periodEndDate}
            </div>
          </div>
          <div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{dict.details.creditsPerPeriod}</div>
            <div className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {formatAppNumber(subscription.creditsPerPeriod, locale)}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          {isActive && !isCancelScheduled ? (
            <>
              <div className="text-sm text-neutral-500 dark:text-neutral-400 text-center sm:text-left">
                {dict.actions.pauseHint}
              </div>
              <SubscriptionActions status={SUBSCRIPTION_STATUS.ACTIVE} periodEnd={periodEndDate} locale={locale} />
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">{dict.actions.expiringHint}</span>
              </div>
              <ResumeSubscriptionButton locale={locale} variant="footer" />
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {dict.actions.planChanges.title}
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {dict.actions.planChanges.description}
          </p>
          {supportEmail ? <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            {dict.actions.planChanges.contactPrefix}{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {dict.actions.planChanges.contactLink}
            </a>
          </p> : null}
        </div>
      </div>
    </div>
  );
}
