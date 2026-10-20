"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import {
  DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE,
  type DashboardTranscriptionsListResponse,
} from "@markless/shared/src/lib/transcriptions/dashboard-list";
import { useLocale } from "@/hooks";
import { useApiResource } from "@/hooks/use-api-resource";
import { useReloadOnTranscriptionClaimCompleted } from "@/hooks/use-reload-on-transcription-claim-completed";
import { buildDashboardPath, buildDashboardTranscriptionsPath } from "@/lib/dashboard/paths";
import { DashboardTranscriptionList } from "@/components/dashboard/dashboard-transcription-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

function clampPageValue(value: string, totalPages: number): number | null {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(Math.max(1, parsed), totalPages);
}

export function DashboardTranscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dictionary } = useLocale();
  const dashboardDict = dictionary.pages.dashboard;
  const listDict = dashboardDict.list;
  const pageDict = dashboardDict.transcriptions;

  const pageParam = searchParams.get("page") ?? "1";
  const parsedPage = Number.parseInt(pageParam, 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const activeQuery = searchParams.get("q")?.trim() ?? "";

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("limit", String(DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE));
    if (activeQuery) {
      params.set("q", activeQuery);
    }
    return `/api/user/transcriptions?${params.toString()}`;
  }, [activeQuery, currentPage]);

  const { data, loading, error, reload } = useApiResource<DashboardTranscriptionsListResponse>(apiPath);
  useReloadOnTranscriptionClaimCompleted(reload);

  const [searchDraft, setSearchDraft] = useState(activeQuery);
  const [pageDraft, setPageDraft] = useState(String(currentPage));

  const items = data?.items ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalCount: data?.totalCount ?? 0,
      totalPages: 1,
      currentPage,
      pageSize: DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE,
      hasPrev: false,
      hasNext: false,
    } as NonNullable<DashboardTranscriptionsListResponse["pagination"]>);

  useEffect(() => {
    setSearchDraft(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    setPageDraft(String(pagination.currentPage));
  }, [pagination.currentPage]);

  const buildHref = (page: number) =>
    buildDashboardTranscriptionsPath(locale, {
      q: activeQuery || undefined,
      page,
    });

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchDraft.trim();
    router.push(
      buildDashboardTranscriptionsPath(locale, {
        q: nextQuery || undefined,
        page: 1,
      })
    );
  };

  const handleClearSearch = () => {
    setSearchDraft("");
    router.push(buildDashboardTranscriptionsPath(locale));
  };

  const commitPageJump = () => {
    const targetPage = clampPageValue(pageDraft, pagination.totalPages);
    if (targetPage === null) {
      setPageDraft(String(pagination.currentPage));
      return;
    }

    setPageDraft(String(targetPage));
    if (targetPage !== pagination.currentPage) {
      router.push(
        buildDashboardTranscriptionsPath(locale, {
          q: activeQuery || undefined,
          page: targetPage,
        })
      );
    }
  };

  const pageSize = pagination.pageSize ?? DASHBOARD_TRANSCRIPTIONS_PAGE_SIZE;
  const rangeStart =
    pagination.totalCount === 0 ? 0 : (pagination.currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(pagination.currentPage * pageSize, pagination.totalCount);
  const showingLabel = formatTemplate(pageDict.pagination.showing, {
    start: rangeStart,
    end: rangeEnd,
    total: pagination.totalCount,
  });

  const hasActiveSearch = activeQuery.length > 0;
  const showSearchEmpty = !loading && !error && items.length === 0 && hasActiveSearch;
  const showEmpty = !loading && !error && items.length === 0 && !hasActiveSearch;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{pageDict.title}</h1>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start"
        onSubmit={handleSearchSubmit}
      >
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={pageDict.search.placeholder}
            className="w-full border-slate-200 bg-white pl-9 pr-9 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200/80 focus-visible:ring-offset-0"
            aria-label={pageDict.search.placeholder}
          />
          {searchDraft.length > 0 ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label={pageDict.search.clear}
              onClick={() => {
                setSearchDraft("");
                if (hasActiveSearch) {
                  router.push(buildDashboardTranscriptionsPath(locale));
                }
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" className="min-h-10 shrink-0">
            {pageDict.search.submit}
          </Button>
          {hasActiveSearch ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 shrink-0"
              onClick={handleClearSearch}
            >
              <X className="size-4" aria-hidden="true" />
              {pageDict.search.clear}
            </Button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl bg-white text-sm text-slate-500">
          <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
          {pageDict.loading}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageDict.error}
        </div>
      ) : showSearchEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-medium text-slate-900">
            {formatTemplate(pageDict.searchEmpty.title, { query: activeQuery })}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{pageDict.searchEmpty.description}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={handleClearSearch}>
            {pageDict.search.clear}
          </Button>
        </div>
      ) : showEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-medium text-slate-900">{pageDict.empty.title}</h2>
          <p className="mt-2 text-sm text-slate-500">{pageDict.empty.description}</p>
          <Link
            href={buildDashboardPath(locale)}
            className="mt-4 inline-flex text-sm font-medium text-primary hover:text-primary/90"
          >
            {pageDict.empty.backToDashboard}
          </Link>
        </div>
      ) : (
        <>
          <DashboardTranscriptionList items={items} listDict={listDict} locale={locale} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">{showingLabel}</p>

            {pagination.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                {pagination.hasPrev ? (
                  <Link
                    href={buildHref(pagination.currentPage - 1)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{pageDict.pagination.previous}</span>
                  </Link>
                ) : (
                  <div className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 opacity-40">
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{pageDict.pagination.previous}</span>
                  </div>
                )}

                <div className="mx-1 flex items-center gap-1 text-sm font-medium text-slate-600">
                  <Input
                    value={pageDraft}
                    onChange={(event) => setPageDraft(event.target.value)}
                    onBlur={commitPageJump}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitPageJump();
                      }
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={pageDict.pagination.pageAria}
                    disabled={loading}
                    className="h-9 w-14 border-slate-200 bg-white px-2 text-center tabular-nums focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200/80 focus-visible:ring-offset-0"
                  />
                  <span className="text-slate-400">/</span>
                  <span>{pagination.totalPages}</span>
                </div>

                {pagination.hasNext ? (
                  <Link
                    href={buildHref(pagination.currentPage + 1)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <span className="hidden sm:inline">{pageDict.pagination.next}</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 opacity-40">
                    <span className="hidden sm:inline">{pageDict.pagination.next}</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
