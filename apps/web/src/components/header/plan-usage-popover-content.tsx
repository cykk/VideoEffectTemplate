"use client";

import { Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanUsageHoverHint } from "@/components/header/plan-usage-hover-hint";
import { PlanUsageProgress } from "@/components/header/plan-usage-progress";
import { PlanUsageMetricRow, PlanUsageFractionValue } from "@/components/header/plan-usage-metric-row";
import { formatAppDate, formatAppNumber } from "@/lib/formatters";
import type { HeaderDictionary, Locale } from "@markless/shared/src/i18n/types";
import type {
  UserEntitlements,
  UserPackUsageEntitlements,
  UserSubscriptionUsageEntitlements,
} from "@markless/shared/src/types/user-entitlements";
import {
  getDisplayPlanIdFromSubscriptionPlanId,
  type DisplayPlanId,
} from "@markless/shared/src/lib/pricing/display-plans";

type PlanUsagePopoverContentProps = {
  entitlements: UserEntitlements;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
  onUpgrade: () => void;
};

type SubscriptionEntitlements = Extract<UserEntitlements, { billingMode: "subscription" }>;

export function formatPlanUsageTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

function resolveTierName(
  planId: string,
  dictionary: HeaderDictionary["planUsage"]
): string {
  const displayPlanId = getDisplayPlanIdFromSubscriptionPlanId(planId);
  if (displayPlanId === "free") {
    return dictionary.free.badgeLabel;
  }

  return dictionary.subscription.tierNames[displayPlanId as Exclude<DisplayPlanId, "free">];
}

function getSubscriptionPlanProgress(subscriptionUsage: UserSubscriptionUsageEntitlements) {
  const { minutesRemaining, minutesIncluded, minutesUsed } = subscriptionUsage;
  const hasCarryover = minutesRemaining > minutesIncluded;

  return {
    hasCarryover,
    carryoverMinutes: hasCarryover ? minutesRemaining - minutesIncluded : 0,
    progressUsed: hasCarryover ? 0 : minutesUsed,
    progressTotal: hasCarryover ? minutesRemaining : minutesIncluded,
  };
}

function getSubscriptionPlanProgressLabel(
  subscriptionUsage: UserSubscriptionUsageEntitlements,
  dictionary: HeaderDictionary["planUsage"],
  locale: Locale
): string {
  const { minutesRemaining, minutesIncluded, minutesUsed } = subscriptionUsage;
  const { hasCarryover } = getSubscriptionPlanProgress(subscriptionUsage);
  const subDict = dictionary.subscription;

  if (hasCarryover) {
    return formatPlanUsageTemplate(subDict.minutesAvailableRemaining, {
      remaining: formatAppNumber(minutesRemaining, locale),
    });
  }

  if (minutesUsed === 0) {
    return formatPlanUsageTemplate(subDict.minutesAvailable, {
      included: formatAppNumber(minutesIncluded, locale),
    });
  }

  return formatPlanUsageTemplate(subDict.minutesUsed, {
    used: formatAppNumber(minutesUsed, locale),
    included: formatAppNumber(minutesIncluded, locale),
  });
}

function FreePlanUsageCard({
  entitlements,
  dictionary,
  onUpgrade,
}: {
  entitlements: Extract<UserEntitlements, { billingMode: "free" }>;
  dictionary: HeaderDictionary["planUsage"];
  onUpgrade: () => void;
}) {
  const { freeDaily } = entitlements;
  const freeDict = dictionary.free;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-sm font-medium text-slate-700">
          {freeDict.currentPlanLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {freeDict.badgeLabel}
        </span>
      </div>

      <div className="space-y-3">
        <PlanUsageMetricRow
          icon={<FileText className="size-4" aria-hidden="true" />}
          label={freeDict.metrics.daily}
          value={
            <PlanUsageFractionValue used={freeDaily.used} total={freeDaily.limit} />
          }
          used={freeDaily.used}
          total={freeDaily.limit}
        />

        <PlanUsageMetricRow
          icon={<Clock className="size-4" aria-hidden="true" />}
          label={freeDict.metrics.perFile}
          value={formatPlanUsageTemplate(freeDict.perFileValue, {
            minutes: freeDaily.durationLimitMinutes,
          })}
        />
      </div>

      <Button type="button" className="w-full" onClick={onUpgrade}>
        {freeDict.upgrade}
      </Button>
    </div>
  );
}

function PackUsageLine({
  packUsage,
  dictionary,
  locale,
  withDivider = false,
}: {
  packUsage: UserPackUsageEntitlements;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
  withDivider?: boolean;
}) {
  const subDict = dictionary.subscription;
  const packRemaining = formatAppNumber(packUsage.minutesRemaining, locale);
  const content = (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {formatPlanUsageTemplate(subDict.minutePackMinutesLeft, {
          remaining: packRemaining,
        })}
      </span>
      <PlanUsageHoverHint
        variant="pack-expiry"
        ariaLabel={subDict.minutePackNeverExpiresHintAria}
        tooltip={subDict.minutePackNeverExpires}
      />
    </span>
  );

  if (withDivider) {
    return (
      <div className="overflow-visible border-t border-slate-100 pt-3">
        {content}
      </div>
    );
  }

  return <div className="overflow-visible">{content}</div>;
}

function CreditsPlanUsageCard({
  entitlements,
  dictionary,
  locale,
  onUpgrade,
}: {
  entitlements: Extract<UserEntitlements, { billingMode: "credits" }>;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
  onUpgrade: () => void;
}) {
  const { packUsage } = entitlements;
  const creditsDict = dictionary.credits;

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-100 pb-2">
        <p className="text-sm font-semibold text-foreground">{creditsDict.title}</p>
      </div>

      <PackUsageLine packUsage={packUsage} dictionary={dictionary} locale={locale} />

      <Button type="button" className="w-full" onClick={onUpgrade}>
        {creditsDict.buyMinutes}
      </Button>
    </div>
  );
}

function SubscriptionPlanHeader({
  subscriptionUsage,
  dictionary,
}: {
  subscriptionUsage: UserSubscriptionUsageEntitlements;
  dictionary: HeaderDictionary["planUsage"];
}) {
  const intervalLabel =
    subscriptionUsage.interval === "year"
      ? dictionary.interval.yearly
      : dictionary.interval.monthly;
  const tierName = resolveTierName(subscriptionUsage.planId, dictionary);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-foreground">
        {formatPlanUsageTemplate(dictionary.subscription.planTitle, { tier: tierName })}
      </p>
      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
        {intervalLabel}
      </span>
    </div>
  );
}

function SubscriptionPlanProgressSection({
  subscriptionUsage,
  dictionary,
  locale,
}: {
  subscriptionUsage: UserSubscriptionUsageEntitlements;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
}) {
  const { progressUsed, progressTotal } = getSubscriptionPlanProgress(subscriptionUsage);
  const progressLabel = getSubscriptionPlanProgressLabel(subscriptionUsage, dictionary, locale);
  const subDict = dictionary.subscription;

  return (
    <PlanUsageProgress
      label={progressLabel}
      used={progressUsed}
      total={progressTotal}
      labelSuffix={
        subscriptionUsage.periodReset ? (
          <PlanUsageHoverHint
            variant="plan-reset"
            ariaLabel={subDict.planResetsHintAria}
            tooltip={formatPlanUsageTemplate(subDict.planResetsOn, {
              date: formatAppDate(subscriptionUsage.periodReset, locale),
            })}
          />
        ) : null
      }
    />
  );
}

function SubscriptionOnlyPlanUsageCard({
  subscriptionUsage,
  dictionary,
  locale,
  onUpgrade,
  showChangePlan,
}: {
  subscriptionUsage: UserSubscriptionUsageEntitlements;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
  onUpgrade: () => void;
  showChangePlan: boolean;
}) {
  return (
    <div className="space-y-4">
      <SubscriptionPlanHeader subscriptionUsage={subscriptionUsage} dictionary={dictionary} />

      <SubscriptionPlanProgressSection
        subscriptionUsage={subscriptionUsage}
        dictionary={dictionary}
        locale={locale}
      />

      {showChangePlan ? (
        <Button type="button" className="w-full" onClick={onUpgrade}>
          {dictionary.subscription.changePlan}
        </Button>
      ) : null}
    </div>
  );
}

function SubscriptionWithPackPlanUsageCard({
  subscriptionUsage,
  packUsage,
  dictionary,
  locale,
  onUpgrade,
  showChangePlan,
}: {
  subscriptionUsage: UserSubscriptionUsageEntitlements;
  packUsage: UserPackUsageEntitlements;
  dictionary: HeaderDictionary["planUsage"];
  locale: Locale;
  onUpgrade: () => void;
  showChangePlan: boolean;
}) {
  const subDict = dictionary.subscription;

  return (
    <div className="space-y-4">
      <SubscriptionPlanHeader subscriptionUsage={subscriptionUsage} dictionary={dictionary} />

      <SubscriptionPlanProgressSection
        subscriptionUsage={subscriptionUsage}
        dictionary={dictionary}
        locale={locale}
      />

      <PackUsageLine
        packUsage={packUsage}
        dictionary={dictionary}
        locale={locale}
        withDivider
      />

      {showChangePlan ? (
        <Button type="button" className="w-full" onClick={onUpgrade}>
          {subDict.changePlan}
        </Button>
      ) : null}
    </div>
  );
}

export function PlanUsagePopoverContent({
  entitlements,
  dictionary,
  locale,
  onUpgrade,
}: PlanUsagePopoverContentProps) {
  if (entitlements.billingMode === "free") {
    return (
      <FreePlanUsageCard
        entitlements={entitlements}
        dictionary={dictionary}
        onUpgrade={onUpgrade}
      />
    );
  }

  if (entitlements.billingMode === "credits") {
    return (
      <CreditsPlanUsageCard
        entitlements={entitlements}
        dictionary={dictionary}
        locale={locale}
        onUpgrade={onUpgrade}
      />
    );
  }

  const { subscriptionUsage, packUsage } = entitlements;
  const currentPlanId = getDisplayPlanIdFromSubscriptionPlanId(subscriptionUsage.planId);
  const showChangePlan = currentPlanId !== "pro";

  if (packUsage) {
    return (
      <SubscriptionWithPackPlanUsageCard
        subscriptionUsage={subscriptionUsage}
        packUsage={packUsage}
        dictionary={dictionary}
        locale={locale}
        onUpgrade={onUpgrade}
        showChangePlan={showChangePlan}
      />
    );
  }

  return (
    <SubscriptionOnlyPlanUsageCard
      subscriptionUsage={subscriptionUsage}
      dictionary={dictionary}
      locale={locale}
      onUpgrade={onUpgrade}
      showChangePlan={showChangePlan}
    />
  );
}

export function buildSubscriptionBadgeLabel(
  entitlements: SubscriptionEntitlements,
  dictionary: HeaderDictionary["planUsage"]
): string {
  const { subscriptionUsage } = entitlements;
  const tierName = resolveTierName(subscriptionUsage.planId, dictionary);

  return formatPlanUsageTemplate(dictionary.subscription.badgeLabel, {
    tier: tierName,
  });
}

export function buildCreditsBadgeLabel(
  entitlements: Extract<UserEntitlements, { billingMode: "credits" }>,
  dictionary: HeaderDictionary["planUsage"],
  locale: Locale
): string {
  return formatPlanUsageTemplate(dictionary.credits.badgeLabel, {
    remaining: formatAppNumber(entitlements.packUsage.minutesRemaining, locale),
  });
}
