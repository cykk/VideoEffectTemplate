"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppUpgradeDialog } from "@/components/pricing/app-upgrade-dialog";
import { defaultLocale } from "@markless/shared/src/i18n";
import type { AppDictionary, Locale } from "@markless/shared/src/i18n/types";
import { formatAppNumber } from "@/lib/formatters";

interface SettingsOverviewProps {
  locale: Locale;
  dictionary: AppDictionary;
  user: Record<string, unknown>;
  stats: {
    credits: {
      total: number;
      plan: number;
      pack: number;
      planExpiresAt: string;
    };
    plan: {
      name: string;
      price: string;
      period: string;
      nextBillingDate: string;
      nextBillingAmount: string;
    };
  };
}

export function SettingsOverview({ locale, dictionary, stats }: SettingsOverviewProps) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const SettingsPage = dictionary.pages.membership.page;
  const subscriptionPage = dictionary.pages.membership.subscriptionPage;
  const ordersPage = dictionary.pages.orders;
  const subscriptionHref =
    locale === defaultLocale ? "/settings/subscription" : `/${locale}/settings/subscription`;
  const expiresText = SettingsPage.overviewCards.credits.expires.replace(
    "{date}",
    stats.credits.planExpiresAt
  );

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {SettingsPage.header.title}
        </h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400">
          {SettingsPage.header.subtitle}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="cursor-default rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                {SettingsPage.overviewCards.credits.label}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setIsUpgradeModalOpen(true)}
              className="cursor-pointer border-0 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="size-4" aria-hidden="true" />
              {SettingsPage.overviewCards.credits.button}
            </Button>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatAppNumber(stats.credits.total, locale)}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {SettingsPage.creditsTab.balance.total}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-900">
            <div>
              <div className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {SettingsPage.creditsTab.breakdown.subscription.label}
              </div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {formatAppNumber(stats.credits.plan, locale)}
              </div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                {expiresText}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {SettingsPage.creditsTab.breakdown.purchased.label}
              </div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {formatAppNumber(stats.credits.pack, locale)}
              </div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                {SettingsPage.creditsTab.breakdown.purchased.source}
              </div>
            </div>
          </div>
        </div>

        <div className="cursor-default rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20">
                <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                {SettingsPage.overviewCards.plan.label}
              </span>
            </div>
            <Link href={subscriptionHref}>
              <Button
                size="sm"
                className="cursor-pointer border-0 bg-neutral-900 text-white shadow-sm transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {SettingsPage.overviewCards.plan.button}
              </Button>
            </Link>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.plan.name}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {stats.plan.price} / {stats.plan.period}
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4 dark:border-neutral-900">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">
                {subscriptionPage.details.nextBillingDate}
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {stats.plan.nextBillingDate}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">
                {ordersPage.orderCard.amount}
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {stats.plan.nextBillingAmount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AppUpgradeDialog
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        entrySurface="settings_page_recharge"
        defaultTab="subscription"
        defaultSubscriptionPeriod="one-time"
      />
    </div>
  );
}
