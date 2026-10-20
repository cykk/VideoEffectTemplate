"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { toastConfirmOptions } from "@markless/shared/src/lib/toast-options";
import {
  DASHBOARD_RECENT_TRANSCRIPTIONS_LIMIT,
  type DashboardTranscriptionsListResponse,
} from "@markless/shared/src/lib/transcriptions/dashboard-list";
import { useLocale } from "@/hooks";
import { useApiResource } from "@/hooks/use-api-resource";
import { useReloadOnTranscriptionClaimCompleted } from "@/hooks/use-reload-on-transcription-claim-completed";
import { DashboardPaymentSuccessHandler } from "@/components/payment/dashboard-payment-success-handler";
import { buildDashboardTranscriptionsPath } from "@/lib/dashboard/paths";
import { DashboardTranscriptionList } from "@/components/dashboard/dashboard-transcription-list";

function HeroUploadSectionFallback() {
  const { dictionary } = useLocale();

  return (
    <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
      <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
      {dictionary.pages.dashboard.uploadLoading}
    </div>
  );
}

const DashboardTranscriptionUpload = dynamic(
  () =>
    import("@/components/dashboard/dashboard-transcription-upload").then(
      (module) => module.DashboardTranscriptionUpload
    ),
  {
    loading: () => <HeroUploadSectionFallback />,
  }
);

export function DashboardPage() {
  const { locale, dictionary } = useLocale();
  const dashboardDict = dictionary.pages.dashboard;
  const listDict = dashboardDict.list;
  const { data, loading, error, reload } = useApiResource<DashboardTranscriptionsListResponse>(
    `/api/user/transcriptions?limit=${DASHBOARD_RECENT_TRANSCRIPTIONS_LIMIT}`
  );
  useReloadOnTranscriptionClaimCompleted(reload);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const reloadInFlightRef = useRef(false);
  const reloadList = useCallback(async () => {
    if (reloadInFlightRef.current) return;
    reloadInFlightRef.current = true;
    try {
      await reload({ silent: true });
    } finally {
      reloadInFlightRef.current = false;
    }
  }, [reload]);

  const handleTranscriptionCreated = useCallback(async () => {
    await reloadList();
    toast.success(dashboardDict.transcriptionStarted, {
      ...toastConfirmOptions,
      duration: 6000,
    });
  }, [dashboardDict.transcriptionStarted, reloadList]);

  useEffect(() => {
    const hasProcessing = items.some((item) =>
      ["queued", "preprocessing", "transcribing"].includes(item.status)
    );
    if (!hasProcessing) return;
    const timer = window.setInterval(() => {
      void reloadList();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [items, reloadList]);
  const totalCount = data?.totalCount ?? 0;
  const showViewAll = totalCount > DASHBOARD_RECENT_TRANSCRIPTIONS_LIMIT;

  return (
    <div className="space-y-8">
      <DashboardPaymentSuccessHandler />
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {dashboardDict.title}
        </h1>
      <DashboardTranscriptionUpload onTranscriptionCreated={handleTranscriptionCreated} />
      </section>

      <section>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{listDict.title}</h2>
            {listDict.description ? (
              <p className="mt-1 text-sm text-slate-500">{listDict.description}</p>
            ) : null}
          </div>
          {showViewAll ? (
            <Link
              href={buildDashboardTranscriptionsPath(locale)}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/90"
            >
              {listDict.viewAll}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl bg-white text-sm text-slate-500">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            {listDict.loading}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {listDict.error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <h3 className="text-base font-medium text-slate-900">{listDict.empty.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{listDict.empty.description}</p>
          </div>
        ) : (
          <DashboardTranscriptionList items={items} listDict={listDict} locale={locale} />
        )}
      </section>
    </div>
  );
}
