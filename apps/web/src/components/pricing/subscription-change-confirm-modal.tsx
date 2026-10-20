"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  DollarSign,
  Sparkles,
  Gem,
  Calendar,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import { paymentMessages } from "@markless/shared/src/lib/payments/messages";
import { resolveIntlLocale } from "@markless/shared/src/i18n/locale-config";
import { cn } from "@markless/shared/src/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Locale, SubscriptionChangeModalDictionary } from "@markless/shared/src/i18n/types";
import { formatAppCurrency, formatAppNumber } from "@/lib/formatters";

type ChangeType = "upgrade" | "downgrade" | "switch_to_yearly" | "switch_to_monthly";

interface SubscriptionChangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changeType: ChangeType;
  currentPlan: {
    name: string;
    credits: number;
    price: number;
    interval: "month" | "year";
  };
  newPlan: {
    id?: string;
    name: string;
    credits: number;
    price: number;
    interval: "month" | "year";
  };
  prorationAmount?: number;
  remainingDays?: number;
  effectiveDate?: Date;
  locale?: Locale;
  isLoading?: boolean;
  currentCredits?: number;
  dictionary: SubscriptionChangeModalDictionary;
}

type DetailHighlight = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
};

type ModalConfig = {
  title: string;
  badge?: string;
  badgeClassName?: string;
  buttonText: string;
  loadingText: string;
  confirmVariant: "primary" | "muted";
  hero?: { label: string; value: ReactNode };
  details: DetailHighlight[];
};

const BADGE_PRIMARY =
  "rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary";
const BADGE_EMERALD =
  "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700";
const BADGE_SKY =
  "rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700";
const BADGE_SLATE =
  "rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600";

function DetailRow({ icon: Icon, label, value }: DetailHighlight) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function PlanComparisonCard({
  plan,
  dict,
  tone,
  locale,
}: {
  plan: SubscriptionChangeConfirmModalProps["currentPlan"];
  dict: SubscriptionChangeModalDictionary;
  tone: "current" | "new";
  locale: Locale;
}) {
  const isNew = tone === "new";

  return (
    <div
      className={cn(
        "flex min-h-[112px] min-w-0 flex-1 flex-col gap-4 rounded-xl border px-4 pb-5 pt-4",
        isNew
          ? "border-primary bg-primary/5 ring-1 ring-primary/10"
          : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="text-center text-base font-medium leading-tight text-slate-900">
        {plan.name}
      </div>
      <PlanValueSummary plan={plan} dict={dict} locale={locale} />
    </div>
  );
}

function PlanValueSummary({
  plan,
  dict,
  locale,
}: {
  plan: SubscriptionChangeConfirmModalProps["currentPlan"];
  dict: SubscriptionChangeModalDictionary;
  locale: Locale;
}) {
  const monthlyPrice = plan.interval === "year" ? plan.price / 12 : plan.price;

  return (
    <div className="space-y-1.5 text-center">
      <div className="text-sm font-medium leading-snug tabular-nums text-slate-700">
        {formatAppNumber(plan.credits, locale)} {dict.labels.credits}
      </div>
      <div className="text-sm font-medium leading-snug tabular-nums text-slate-700">
        {formatAppCurrency(monthlyPrice, "USD", locale)}
        {dict.labels.perMonth}
      </div>
      {plan.interval === "year" ? (
        <div className="text-xs font-normal leading-snug text-slate-500">
          {dict.labels.billedYearly.replace(
            "${price}",
            formatAppCurrency(plan.price, "USD", locale)
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SubscriptionChangeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  changeType,
  currentPlan,
  newPlan,
  effectiveDate,
  locale = "en",
  isLoading = false,
  currentCredits,
  dictionary,
}: SubscriptionChangeConfirmModalProps) {
  const router = useRouter();
  const dict = dictionary;
  const intlLocale = resolveIntlLocale(locale);

  const formatEffectiveDate = (date?: Date) =>
    date?.toLocaleDateString(intlLocale) ?? dict.values.nextBillingCycle;

  const [previewData, setPreviewData] = useState<{
    proration_amount: number;
    remaining_days: number;
    current_price: number;
    new_price: number;
    requires_checkout?: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      router.prefetch(`/${locale}/dashboard?type=subscription&upgrade=true`);
    } else {
      setPreviewData(null);
    }
  }, [isOpen, router, locale]);

  useEffect(() => {
    if (isOpen && (changeType === "upgrade" || changeType === "switch_to_yearly")) {
      if (previewData?.new_price) {
        return;
      }

      const fetchPreview = async () => {
        setPreviewLoading(true);
        try {
          if (!newPlan.id) {
            return;
          }

          const response = await apiFetch("/api/subscriptions/preview-upgrade", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              new_plan_id: newPlan.id,
            }),
          });

          const result = await response.json();

          if (result.ok && result.data) {
            setPreviewData(result.data);
          }
        } catch (error) {
          console.error("[ConfirmModal] Failed to fetch preview:", error);
        } finally {
          setPreviewLoading(false);
        }
      };

      void fetchPreview();
    }
  }, [isOpen, changeType, newPlan.id, previewData]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  const renderRolloverDetail = (): DetailHighlight | null => {
    if (!currentCredits || currentCredits <= 0) {
      return null;
    }

    return {
      icon: Gem,
      label: dict.highlights.existingBalance,
      value: (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-700">
            {dict.values.creditsRollover.replace(
              "${credits}",
              formatAppNumber(currentCredits, locale)
            )}
          </span>
          <span className={BADGE_SLATE}>{dict.badges.rollover}</span>
        </div>
      ),
    };
  };

  const renderUpgradeHero = (): ReactNode => {
    if (previewData?.requires_checkout) return <span>{paymentMessages.subscription.action.confirm}</span>;
    if (previewLoading) {
      return <span className="text-slate-500">{dict.values.calculating}</span>;
    }

    if (previewData) {
      const savePercent = Math.round(
        (1 - previewData.proration_amount / newPlan.price) * 100
      );

      return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base text-slate-400 line-through">
            {formatAppCurrency(newPlan.price, "USD", locale)}
          </span>
          <span className="text-2xl font-bold text-primary">
            {formatAppCurrency(previewData.proration_amount, "USD", locale)}
          </span>
          {savePercent > 0 ? (
            <span className="text-sm font-medium text-emerald-700">
              {dict.values.savePercent.replace("${percent}", String(savePercent))}
            </span>
          ) : null}
        </div>
      );
    }

    return <span className="text-slate-500">{dict.values.calculating}</span>;
  };

  const getModalConfig = (): ModalConfig => {
    switch (changeType) {
      case "upgrade": {
        const rolloverDetail = renderRolloverDetail();
        const details: DetailHighlight[] = [
          {
            icon: Sparkles,
            label: dict.highlights.creditsAdded,
            value: (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">
                  +{formatAppNumber(newPlan.credits, locale)}
                </span>
                <span className={BADGE_EMERALD}>{dict.badges.fullAmount}</span>
              </div>
            ),
          },
          ...(rolloverDetail ? [rolloverDetail] : []),
          {
            icon: Calendar,
            label: dict.highlights.effective,
            value: dict.values.immediately,
          },
        ];

        return {
          title: dict.upgrade.firstTime.title,
          buttonText: dict.upgrade.buttonText,
          loadingText: dict.upgrade.loadingText,
          confirmVariant: "primary",
          hero: {
            label: dict.highlights.totalDueToday,
            value: renderUpgradeHero(),
          },
          details,
        };
      }

      case "downgrade":
        return {
          title: dict.downgrade.title,
          buttonText: dict.downgrade.buttonText,
          loadingText: dict.downgrade.loadingText,
          confirmVariant: "muted",
          details: [
            {
              icon: Calendar,
              label: dict.highlights.effective,
              value: formatEffectiveDate(effectiveDate),
            },
            {
              icon: CheckCircle2,
              label: dict.highlights.currentBenefits,
              value: dict.values.activeUntil.replace(
                "${date}",
                effectiveDate ? effectiveDate.toLocaleDateString(intlLocale) : ""
              ),
            },
            {
              icon: DollarSign,
              label: dict.highlights.charges,
              value: dict.values.noCharges,
            },
          ],
        };

      case "switch_to_yearly": {
        const yearlyMonthlyCredits = newPlan.credits;
        const rolloverDetail = renderRolloverDetail();

        return {
          title: dict.switchToYearly.title,
          buttonText: dict.switchToYearly.buttonText,
          loadingText: dict.upgrade.loadingText,
          confirmVariant: "primary",
          hero: {
            label: dict.highlights.totalDueToday,
            value: previewLoading ? (
              <span className="text-slate-500">{dict.values.calculating}</span>
            ) : previewData?.requires_checkout ? (
              <span>{paymentMessages.subscription.action.confirm}</span>
            ) : previewData ? (
              <div className="space-y-1">
                <span className="text-2xl font-bold text-primary">
                  {formatAppCurrency(previewData.proration_amount, "USD", locale)}
                </span>
                {previewData.remaining_days > 0 ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                    {dict.values.includesCredit.replace(
                      "${days}",
                      previewData.remaining_days.toString()
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <span className="text-slate-500">{dict.values.calculating}</span>
            ),
          },
          details: [
            {
              icon: Sparkles,
              label: dict.highlights.creditsReceived,
              value: (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      +{formatAppNumber(yearlyMonthlyCredits, locale)}
                    </span>
                    <span className={BADGE_EMERALD}>{dict.badges.firstMonth}</span>
                  </div>
                  <p className="text-xs text-slate-500">{dict.values.instantGrant}</p>
                </div>
              ),
            },
            ...(rolloverDetail ? [rolloverDetail] : []),
            {
              icon: Calendar,
              label: dict.highlights.effective,
              value: (
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900">
                    {dict.values.immediately}
                  </span>
                  <p className="text-xs text-slate-500">
                    {dict.values.yearlyBillingStarts}
                  </p>
                </div>
              ),
            },
          ],
        };
      }

      case "switch_to_monthly":
        return {
          title: dict.switchToMonthly.title,
          buttonText: dict.switchToMonthly.buttonText,
          loadingText: dict.switchToMonthly.loadingText,
          confirmVariant: "muted",
          details: [
            {
              icon: Calendar,
              label: dict.highlights.effective,
              value: formatEffectiveDate(effectiveDate),
            },
            {
              icon: CheckCircle2,
              label: dict.highlights.currentBenefits,
              value: dict.values.activeUntil.replace(
                "${date}",
                effectiveDate ? effectiveDate.toLocaleDateString(intlLocale) : ""
              ),
            },
            {
              icon: RefreshCw,
              label: dict.highlights.flexibility,
              value: dict.values.monthlyBilling,
            },
          ],
        };
    }
  };

  const config = getModalConfig();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[10020] bg-black/50 backdrop-blur-sm"
        className={cn(
          "z-[10021] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-lg",
          "[&>[data-slot=dialog-close]]:top-3.5 [&>[data-slot=dialog-close]]:right-4",
          "[&>[data-slot=dialog-close]]:z-10 [&>[data-slot=dialog-close]]:rounded-lg [&>[data-slot=dialog-close]]:p-2"
        )}
        onInteractOutside={(event) => {
          if (isLoading) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (isLoading) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">{config.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {currentPlan.name} → {newPlan.name}
        </DialogDescription>

        <div className="relative border-b border-slate-100 px-6 pb-3 pt-5">
          <div className="flex flex-col items-center gap-1.5 px-10 text-center">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {config.title}
            </h2>
            {config.badge ? (
              <span className={config.badgeClassName}>{config.badge}</span>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex min-w-0 items-stretch justify-center gap-3 overflow-hidden">
            <PlanComparisonCard
              plan={currentPlan}
              dict={dict}
              tone="current"
              locale={locale}
            />

            <div className="flex shrink-0 items-center">
              <ArrowRight className="size-5 text-primary" aria-hidden="true" />
            </div>

            <PlanComparisonCard
              plan={newPlan}
              dict={dict}
              tone="new"
              locale={locale}
            />
          </div>

          {config.hero ? (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="text-xs font-medium text-slate-500">
                {config.hero.label}
              </div>
              <div className="mt-0.5">{config.hero.value}</div>
            </div>
          ) : null}

          {config.details.length > 0 ? (
            <div className="mb-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {config.details.map((highlight) => (
                <DetailRow key={highlight.label} {...highlight} />
              ))}
            </div>
          ) : null}

          <div className="flex gap-3 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-11 flex-1 cursor-pointer border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              {dict.buttons.cancel}
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "h-11 flex-1 cursor-pointer text-sm font-semibold transition-colors",
                config.confirmVariant === "primary"
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-slate-200 text-slate-900 hover:bg-slate-300"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {config.loadingText}
                </span>
              ) : (
                config.buttonText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
