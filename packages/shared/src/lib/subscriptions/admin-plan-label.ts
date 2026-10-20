import {
  getProductById,
  type SubscriptionProduct,
} from "@markless/shared/src/lib/products/config";

function getSubscriptionMonthlyCredits(product: SubscriptionProduct): number {
  return product.interval === "year"
    ? Math.floor(product.creditsPerPeriod / 12)
    : product.creditsPerPeriod;
}

function formatPlanLabelWithCredits(tierName: string, monthlyCredits: number): string {
  return `${tierName}-${monthlyCredits}Credits`;
}

export function formatSubscriptionBillingIntervalLabel(
  interval: string | null | undefined
): string | null {
  if (!interval) {
    return null;
  }

  switch (interval.toLowerCase()) {
    case "month":
      return "Monthly";
    case "year":
      return "Yearly";
    default:
      return null;
  }
}

function resolveAdminSubscriptionPlanBaseLabel(input: {
  planId: string;
  planName: string | null | undefined;
}): string {
  const product = getProductById(input.planId);
  if (product?.type === "subscription") {
    const tierName = product.tierName?.trim();
    const monthlyCredits = getSubscriptionMonthlyCredits(product);
    if (tierName && monthlyCredits > 0) {
      return formatPlanLabelWithCredits(tierName, monthlyCredits);
    }
    if (tierName) {
      return tierName;
    }
  }

  const planName = input.planName?.trim();
  if (planName) {
    return planName;
  }

  const planId = input.planId?.trim();
  return planId || "-";
}

/**
 * Admin 订阅列表 Plan 列：套餐名 + 积分（Billing 列单独展示 Monthly / Yearly）。
 */
export function getAdminSubscriptionPlanLabel(input: {
  planId: string;
  planName: string | null | undefined;
}): string {
  return resolveAdminSubscriptionPlanBaseLabel(input);
}
