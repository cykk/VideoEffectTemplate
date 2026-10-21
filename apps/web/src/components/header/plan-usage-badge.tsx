"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { USER_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-user-bootstrap";
import { getDictionary } from "@markless/shared/src/i18n";
import type { HeaderDictionary, Locale } from "@markless/shared/src/i18n/types";
import type { UserEntitlements } from "@markless/shared/src/types/user-entitlements";

type PlanUsageBadgeProps = {
  entitlements: UserEntitlements | null;
  loading?: boolean;
  locale: Locale;
  dictionary: HeaderDictionary["planUsage"];
};

export function PlanUsageBadge({ entitlements, loading = false, locale }: PlanUsageBadgeProps) {
  const queryClient = useQueryClient();
  const copy = getDictionary(locale).app.account.credits;
  if (loading) return <div className="h-9 w-24 animate-pulse rounded bg-slate-100" />;
  if (!entitlements) return null;

  const balance = new Intl.NumberFormat(locale).format(entitlements.totalBalance);
  const rows = [
    [copy.detail.subscription, entitlements.subscriptionCredits],
    [copy.detail.purchased, entitlements.purchasedCredits],
    [copy.detail.bonus, entitlements.bonusCredits],
  ] as const;
  const pricingHref = locale === "en" ? "/pricing" : `/${locale}/pricing`;

  return (
    <Popover onOpenChange={open => {
      if (open) void queryClient.invalidateQueries({ queryKey: USER_BOOTSTRAP_QUERY_KEY, exact: true });
    }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={copy.detail.title}
          className="inline-flex h-9 items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
          <Coins className="size-4 text-emerald-600" aria-hidden="true" />
          {copy.badge.label.replace("{count}", balance)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 rounded p-4">
        <p className="text-sm font-semibold text-slate-900">{copy.detail.title}</p>
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-medium tabular-nums text-slate-900">{new Intl.NumberFormat(locale).format(value)}</dd>
            </div>
          ))}
        </dl>
        <Link href={pricingHref} className="block border-t border-slate-200 pt-3 text-sm font-medium text-emerald-700 hover:underline">
          {copy.action.manage}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
