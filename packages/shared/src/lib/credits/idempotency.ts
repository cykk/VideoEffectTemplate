const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatUtcYearMonth = (date: Date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;

export const formatUtcDate = (date: Date) => date.toISOString().slice(0, 10);

export const buildSubscriptionGrantKey = (subscriptionId: string, date: Date) =>
  `subscription:${subscriptionId}:grant:${formatUtcYearMonth(date)}`;

export const buildSubscriptionUpgradeKey = (
  subscriptionId: string,
  newPlanId: string,
  periodEnd: Date
) => `subscription:${subscriptionId}:upgrade:${newPlanId}:${formatUtcDate(periodEnd)}`;
