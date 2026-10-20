import type { DashboardTranscriptionListItem } from "./dashboard-list";

export const ADMIN_TRANSCRIPTIONS_PAGE_SIZE = 20;

export const ADMIN_TRANSCRIPTIONS_PAGE_SIZES = [10, 20, 30, 50] as const;

export type AdminTranscriptionOwnerFilter = "guest" | "registered";

export type AdminTranscriptionStatusFilter = "succeeded" | "failed";

export type AdminTranscriptionListItem = DashboardTranscriptionListItem & {
  ownerType: "registered" | "anonymous";
  userId: string | null;
  userEmail: string | null;
  isExpired: boolean;
  hasSourceMedia: boolean;
};

export type AdminTranscriptionsListResponse = {
  items: AdminTranscriptionListItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};
