"use client";

import { SettingsOverview } from "@/components/settings/settings-overview";
import type { AppDictionary, Locale } from "@markless/shared/src/i18n/types";
import { useAuthenticatedUserCredits } from "@/hooks/use-authenticated-user-credits";
import type { UserBootstrapData } from "@/hooks/use-user-bootstrap";
import type { UserCreditsData } from "@/hooks/use-user-credits";
import { getProductById } from "@markless/shared/src/lib/products/config";
import { formatAppCurrency, formatAppDate } from "@/lib/formatters";

interface SettingsOverviewContainerProps {
  locale: Locale;
  dictionary: AppDictionary;
}

function getSettingsData(
  bootstrap: UserBootstrapData,
  creditsData: UserCreditsData | null,
  locale: Locale,
  dictionary: AppDictionary
) {
  const credits = creditsData?.creditsBreakdown ?? null;
  const subscription = bootstrap.subscription;
  const SettingsPage = dictionary.pages.membership.page;
  const subscriptionPage = dictionary.pages.membership.subscriptionPage;
  const defaultStats = {
    credits: {
      total: 0,
      plan: 0,
      pack: 0,
      planExpiresAt: "-",
    },
    plan: {
      name: dictionary.pages.membership.plans[0]?.name ?? SettingsPage.overviewCards.plan.label,
      price: "$0",
      period: subscriptionPage.details.interval.month,
      nextBillingDate: "-",
      nextBillingAmount: "-",
    },
  };

  if (credits) {
    defaultStats.credits.total = credits.totalBalance;
    defaultStats.credits.plan = credits.subscriptionCredits;
    defaultStats.credits.pack = credits.purchasedCredits;
  }

  if (subscription) {
    const product = getProductById(subscription.planId);
    const price = product?.type === "subscription" ? product.price : 0;

    defaultStats.plan.name = subscription.planName;
    defaultStats.plan.price = formatAppCurrency(price, "USD", locale);
    defaultStats.plan.period =
      subscription.interval === "year"
        ? subscriptionPage.details.interval.year
        : subscriptionPage.details.interval.month;

    if (subscription.currentPeriodEnd) {
      const periodEndDate = formatAppDate(subscription.currentPeriodEnd, locale);
      defaultStats.plan.nextBillingDate = periodEndDate;
      defaultStats.credits.planExpiresAt = periodEndDate;
    }

    defaultStats.plan.nextBillingAmount = defaultStats.plan.price;
  }

  return defaultStats;
}

export function SettingsOverviewContainer({ locale, dictionary }: SettingsOverviewContainerProps) {
  const { bootstrap, bootstrapLoading, creditsData } =
    useAuthenticatedUserCredits();

  if (bootstrapLoading || !bootstrap?.authenticated || !bootstrap.user) {
    return <div className="min-h-[320px]" />;
  }

  const stats = getSettingsData(bootstrap, creditsData, locale, dictionary);

  return (
    <SettingsOverview
      locale={locale}
      dictionary={dictionary}
      user={bootstrap.user}
      stats={stats}
    />
  );
}

