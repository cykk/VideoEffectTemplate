export const DASHBOARD_RECENT_TRANSCRIPTIONS_LIMIT = 10;
export const DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE = 10;

export type DashboardTranscriptionListPagination = {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type DashboardTranscriptionListItem = {
  publicId: string;
  fileName: string;
  displayTitle: string | null;
  sourceType: "audio" | "video";
  status: "queued" | "preprocessing" | "transcribing" | "succeeded" | "failed";
  stage: string;
  language: string | null;
  sourceDurationMs: number | null;
  processedDurationMs: number | null;
  durationLimitMs: number | null;
  wasDurationTrimmed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DashboardTranscriptionsListResponse = {
  items: DashboardTranscriptionListItem[];
  totalCount: number;
  pagination?: DashboardTranscriptionListPagination;
};
