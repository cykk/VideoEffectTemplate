export const ADMIN_USER_CREDITS_DEFAULT_PAGE_SIZE = 20;

export const ADMIN_USER_CREDITS_PAGE_SIZES = [10, 20, 30, 50] as const;

export type AdminUserCreditTransactionItem = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  source: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  referencePublicId: string | null;
  createdAt: string;
};

export type AdminUserCreditsDetailResponse = {
  user: {
    id: string;
    email: string;
  };
  balance: {
    total: number;
    subscription: number;
    purchased: number;
    bonus: number;
    totalEarned: number;
    totalSpent: number;
  };
  transactions: AdminUserCreditTransactionItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};
