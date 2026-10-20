export type UserFreeDailyEntitlements = {
  used: number;
  limit: number;
  remaining: number;
  durationLimitMinutes: number;
  resetsAt: string;
};

export type UserSubscriptionUsageEntitlements = {
  minutesRemaining: number;
  minutesIncluded: number;
  minutesUsed: number;
  /** 本月额度重置时间（年付按月 drip，月付为账单周期结束） */
  periodReset: string | null;
  planId: string;
  planName: string;
  interval: "month" | "year";
};

export type UserPackUsageEntitlements = {
  minutesRemaining: number;
};

export type UserEntitlements =
  | {
      billingMode: "free";
      freeDaily: UserFreeDailyEntitlements;
    }
  | {
      billingMode: "credits";
      packUsage: UserPackUsageEntitlements;
    }
  | {
      billingMode: "subscription";
      subscriptionUsage: UserSubscriptionUsageEntitlements;
      packUsage: UserPackUsageEntitlements | null;
    };
