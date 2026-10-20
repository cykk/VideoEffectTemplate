"use client";

import { useState } from "react";
import { cn } from "@markless/shared/src/lib/utils";
import { getPricingConfig, type PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";
import { getRepresentativeAnnualDiscountPercent } from "@markless/shared/src/lib/pricing/display-plans";
import { BillingToggle } from "./billing-toggle";
import { PricingCard } from "./pricing-card";
import { type Locale } from "@markless/shared/src/i18n/types";
import { getPricingCopy } from "@markless/shared/src/i18n/components/pricing";

interface PricingComponentProps {
  locale?: Locale;
  showBillingToggle?: boolean;
  defaultPeriod?: PricingPeriod;
  onPlanSelect?: (planId: string, period: PricingPeriod) => void;
  className?: string;
}

export function PricingComponent({
  locale = "en",
  showBillingToggle = true,
  defaultPeriod,
  onPlanSelect,
  className
}: PricingComponentProps) {
  // 默认选中 yearly
  const [selectedPeriod, setSelectedPeriod] = useState<PricingPeriod>(
    defaultPeriod || 'yearly'
  );

  const handlePeriodChange = (period: PricingPeriod) => {
    setSelectedPeriod(period);
  };

  const handlePlanSelect = (planId: string, period: PricingPeriod) => {
    onPlanSelect?.(planId, period);
  };

  const pricingConfig = getPricingConfig(locale);
  const pricingCopy = getPricingCopy(locale);

  return (
    <div className={cn("w-full", className)}>
      {/* 订阅周期切换 */}
      {showBillingToggle && (
        <div className="mb-12">
          <BillingToggle
            period={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            annualDiscountPercent={getRepresentativeAnnualDiscountPercent()}
            labels={{
              oneTime: pricingConfig.billingCycles["one-time"].label,
              monthly: pricingConfig.billingCycles.monthly.label,
              annual: pricingConfig.billingCycles.yearly.label,
              annualSaveBadge: "Save {percent}%",
            }}
          />
        </div>
      )}

      {/* 价格卡片 - 显示 Lite 和 Pro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {pricingConfig.plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            period={selectedPeriod}
            copy={pricingCopy.card}
            onSelect={handlePlanSelect}
            className={cn(
              plan.popular && "md:scale-105"
            )}
          />
        ))}
      </div>

      {/* 年付优惠说明 */}
      {selectedPeriod === 'yearly' && (
        <div className="mt-10 text-center">
          <p className="text-sm text-neutral-500">
            🎉 {pricingCopy.header.yearlyDiscount}
          </p>
        </div>
      )}
    </div>
  );
}
