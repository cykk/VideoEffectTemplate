import {
  creditPackages,
  getMonthlyEquivalentPrice,
  getProductById,
  subscriptionPlans,
  type CreditPackage,
  type SubscriptionProduct,
} from "@markless/shared/src/lib/products/config";
import type { PricingPeriod } from "@markless/shared/src/lib/pricing/i18n-config";
import enDictionary from "@markless/shared/src/i18n/locales/en.json";

export type DisplayPlanId = "free" | "basic" | "standard" | "pro";

export interface DisplayPlanTierMapping {
  id: DisplayPlanId;
  tierId?: "tier1" | "tier2" | "tier3";
  popular?: boolean;
}

export const DISPLAY_PLAN_TIERS: DisplayPlanTierMapping[] = [
  { id: "free" },
  { id: "basic", tierId: "tier1" },
  { id: "standard", tierId: "tier2", popular: true },
  { id: "pro", tierId: "tier3" },
];

export const ONE_TIME_DISPLAY_TIERS: DisplayPlanTierMapping[] = [
  { id: "basic", tierId: "tier1" },
  { id: "standard", tierId: "tier2" },
];

const DISPLAY_PLAN_RANK: Record<DisplayPlanId, number> = {
  free: 0,
  basic: 1,
  standard: 2,
  pro: 3,
};

export function getDisplayPlanIdFromSubscriptionPlanId(
  planId: string | null | undefined
): DisplayPlanId {
  if (!planId) return "free";
  if (planId.startsWith("tier1:")) return "basic";
  if (planId.startsWith("tier2:")) return "standard";
  if (planId.startsWith("tier3:")) return "pro";
  return "free";
}

export function isLowerDisplayPlan(
  planId: DisplayPlanId,
  currentPlanId: DisplayPlanId
): boolean {
  return DISPLAY_PLAN_RANK[planId] < DISPLAY_PLAN_RANK[currentPlanId];
}

const ONE_TIME_PRODUCT_BY_TIER: Partial<Record<string, string>> = {
  tier1: "credit_pack_800",
  tier2: "credit_pack_2000",
};

export interface PricingDisplayValues {
  amount: number;
  periodSuffix: string;
  originalAmount?: number;
  billingNote?: string;
  unavailable?: boolean;
}

export function formatUsdPrice(amount: number): string {
  if (Number.isInteger(amount)) {
    return `$${amount}`;
  }

  const rounded = Math.round(amount * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `$${rounded}`;
  }

  return `$${amount.toFixed(2).replace(/\.?0+$/, "")}`;
}

function getTierPlans(tierId: string): {
  monthly: SubscriptionProduct;
  yearly: SubscriptionProduct;
} | null {
  const monthly = subscriptionPlans.find(
    (plan) => plan.id === `${tierId}:monthly` && plan.isActive
  );
  const yearly = subscriptionPlans.find(
    (plan) => plan.id === `${tierId}:yearly` && plan.isActive
  );

  if (!monthly || !yearly) {
    return null;
  }

  return { monthly, yearly };
}

function getOneTimePackage(tierId: string): CreditPackage | null {
  const productId = ONE_TIME_PRODUCT_BY_TIER[tierId];
  if (!productId) {
    return null;
  }

  const product = creditPackages.find(
    (pack) => pack.id === productId && pack.isActive
  );

  return product ?? null;
}

export function getCheckoutProductId(
  tierId: string,
  period: PricingPeriod
): string | null {
  if (period === "monthly") {
    return `${tierId}:monthly`;
  }

  if (period === "one-time") {
    return ONE_TIME_PRODUCT_BY_TIER[tierId] ?? null;
  }

  return `${tierId}:yearly`;
}

export function getRepresentativeAnnualDiscountPercent(): number {
  const plans = getTierPlans("tier2");
  if (!plans) {
    return 40;
  }

  const monthlyAnnualized = plans.monthly.price * 12;
  const savings = monthlyAnnualized - plans.yearly.price;
  return Math.max(0, Math.round((savings / monthlyAnnualized) * 100));
}

export function getDisplayPricingValues(
  tierId: string,
  period: PricingPeriod,
  labels: {
    perMonth: string;
    perYear: string;
    billedYearly: string;
    billedOneTimeYearly: string;
    oneTimeUnavailable: string;
  }
): PricingDisplayValues | null {
  const plans = getTierPlans(tierId);
  if (!plans) {
    return null;
  }

  const { monthly, yearly } = plans;
  const monthlyEquivalent = getMonthlyEquivalentPrice(yearly);

  if (period === "monthly") {
    return {
      amount: monthly.price,
      periodSuffix: labels.perMonth,
    };
  }

  if (period === "one-time") {
    const oneTimePackage = getOneTimePackage(tierId);
    if (!oneTimePackage) {
      return {
        amount: 0,
        periodSuffix: "",
        billingNote: labels.oneTimeUnavailable,
        unavailable: true,
      };
    }

    return {
      amount: oneTimePackage.price,
      periodSuffix: "",
      billingNote: labels.billedOneTimeYearly,
    };
  }

  return {
    amount: monthlyEquivalent,
    periodSuffix: labels.perMonth,
    originalAmount: monthly.price,
    billingNote: labels.billedYearly.replace(
      "{yearlyTotal}",
      formatUsdPrice(yearly.price)
    ),
  };
}

export function getPlanFeatures(tierId: string): string[] {
  const plans = getTierPlans(tierId);
  return plans?.monthly.features ?? [];
}

export function getSubscriptionMonthlyCredits(
  tierId: string,
  period: PricingPeriod
): number | null {
  const productId = getCheckoutProductId(tierId, period);
  if (!productId || period === "one-time") {
    return null;
  }

  const product = getProductById(productId);
  if (!product || product.type !== "subscription") {
    return null;
  }

  return product.interval === "year"
    ? Math.floor(product.creditsPerPeriod / 12)
    : product.creditsPerPeriod;
}

export function resolveSubscriptionPlanFeatures(
  features: string[],
  monthlyCredits: number | null
): string[] {
  if (monthlyCredits === null) {
    return features;
  }

  return features.map((feature, index) => index === 0
    ? enDictionary.app.billing.catalog.feature.monthlyCredits.replace("{credits}", String(monthlyCredits))
    : feature);
}
