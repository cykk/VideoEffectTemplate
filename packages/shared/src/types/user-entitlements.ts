export type UserEntitlements = {
  totalBalance: number;
  subscriptionCredits: number;
  purchasedCredits: number;
  bonusCredits: number;
  subscription: {
    planId: string;
    planName: string;
    creditsPerPeriod: number;
    currentPeriodEnd: string | null;
  } | null;
};
