"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type {
  AdminTranscriptionOwnerFilter,
  AdminTranscriptionStatusFilter,
  AdminTranscriptionsListResponse,
} from "@markless/shared/src/lib/transcriptions/admin-list";
import { ADMIN_TRANSCRIPTIONS_PAGE_SIZES } from "@markless/shared/src/lib/transcriptions/admin-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminResource } from "@/components/admin/use-admin-resource";
import { cn } from "@markless/shared/src/lib/utils";

type TranscriptionStatus = AdminTranscriptionsListResponse["items"][number]["status"];

const filterFieldFocusClassName =
  "focus:border-slate-400 focus:ring-0 focus-visible:border-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none";

const filterSelectClassName = cn(
  "h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  filterFieldFocusClassName
);

const pageSizeSelectClassName = cn(
  "h-8 w-16 shrink-0 rounded-md border border-input bg-white px-2 text-center text-sm tabular-nums shadow-xs transition-[color,box-shadow] outline-none",
  filterFieldFocusClassName
);

type ListHrefInput = {
  page: number;
  pageSize: number;
  q?: string;
  ownerType?: AdminTranscriptionOwnerFilter;
  status?: AdminTranscriptionStatusFilter;
};

function parsePageParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function parsePageSizeParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "20", 10);
  if (ADMIN_TRANSCRIPTIONS_PAGE_SIZES.includes(parsed as (typeof ADMIN_TRANSCRIPTIONS_PAGE_SIZES)[number])) {
    return parsed;
  }
  return 20;
}

function parseOwnerTypeParam(value: string | null): AdminTranscriptionOwnerFilter | undefined {
  if (value === "guest" || value === "registered") {
    return value;
  }
  return undefined;
}

function parseStatusParam(value: string | null): AdminTranscriptionStatusFilter | undefined {
  if (value === "succeeded" || value === "failed") {
    return value;
  }
  return undefined;
}

function buildListHref(input: ListHrefInput): string {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));
  if (input.q) {
    params.set("q", input.q);
  }
  if (input.ownerType) {
    params.set("ownerType", input.ownerType);
  }
  if (input.status) {
    params.set("status", input.status);
  }
  return `/admin/transcriptions?${params.toString()}`;
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getStatusBadgeClassName(status: TranscriptionStatus): string {
  switch (status) {
    case "succeeded":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "preprocessing":
    case "transcribing":
      return "bg-blue-100 text-blue-700";
    case "queued":
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function AdminTranscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = parsePageParam(searchParams.get("page"));
  const pageSize = parsePageSizeParam(searchParams.get("pageSize"));
  const activeQuery = searchParams.get("q")?.trim() ?? "";
  const activeOwnerType = parseOwnerTypeParam(searchParams.get("ownerType"));
  const activeStatus = parseStatusParam(searchParams.get("status"));

  const listState: ListHrefInput = {
    page: currentPage,
    pageSize,
    q: activeQuery || undefined,
    ownerType: activeOwnerType,
    status: activeStatus,
  };

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("pageSize", String(pageSize));
    if (activeQuery) {
      params.set("q", activeQuery);
    }
    if (activeOwnerType) {
      params.set("ownerType", activeOwnerType);
    }
    if (activeStatus) {
      params.set("status", activeStatus);
    }
    return `/api/admin/transcriptions?${params.toString()}`;
  }, [activeQuery, activeOwnerType, activeStatus, currentPage, pageSize]);

  const { data, loading, error, reload } = useAdminResource<AdminTranscriptionsListResponse>(apiPath);
  const [searchDraft, setSearchDraft] = useState(activeQuery);
  const [ownerDraft, setOwnerDraft] = useState(activeOwnerType ?? "");
  const [statusDraft, setStatusDraft] = useState(activeStatus ?? "");

  const items = data?.items ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalCount: 0,
      totalPages: 1,
      currentPage,
      pageSize,
      hasPrev: false,
      hasNext: false,
    } as AdminTranscriptionsListResponse["pagination"]);

  useEffect(() => {
    setSearchDraft(activeQuery);
    setOwnerDraft(activeOwnerType ?? "");
    setStatusDraft(activeStatus ?? "");
  }, [activeQuery, activeOwnerType, activeStatus]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(
      buildListHref({
        page: 1,
        pageSize,
        q: searchDraft.trim() || undefined,
        ownerType: ownerDraft === "guest" || ownerDraft === "registered" ? ownerDraft : undefined,
        status:
          statusDraft === "succeeded" || statusDraft === "failed" ? statusDraft : undefined,
      })
    );
  };

  const openTranscriptionDetail = (publicId: string) => {
    window.open(`/transcriptions/${publicId}`, "_blank", "noopener,noreferrer");
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    router.push(
      buildListHref({
        ...listState,
        page: 1,
        pageSize: nextPageSize,
      })
    );
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Transcriptions</h1>
      </header>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="relative w-full max-w-[16rem] sm:w-64 sm:flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by file name, title, email, or public ID"
            className={cn("pl-9 shadow-none", filterFieldFocusClassName)}
            aria-label="Search transcriptions"
          />
        </div>
        <select
          value={ownerDraft}
          onChange={(event) => setOwnerDraft(event.target.value)}
          className={filterSelectClassName}
          aria-label="Filter by owner type"
        >
          <option value="">All owners</option>
          <option value="guest">Guest</option>
          <option value="registered">Registered</option>
        </select>
        <select
          value={statusDraft}
          onChange={(event) => setStatusDraft(event.target.value)}
          className={filterSelectClassName}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
        </select>
        <Button type="submit" disabled={loading}>
          Search
        </Button>
      </form>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading transcriptions...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-200 hover:bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Public ID</TableHead>
                <TableHead className="w-[140px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-slate-200 hover:bg-white">
                  <TableCell colSpan={7} className="text-slate-500">
                    No transcription jobs found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item.publicId}
                    className="cursor-pointer border-slate-200 hover:bg-slate-50/70"
                    onClick={() => openTranscriptionDetail(item.publicId)}
                  >
                    <TableCell className="max-w-[240px]">
                      <p className="truncate font-medium text-slate-900">
                        {item.displayTitle ?? item.fileName}
                      </p>
                      {item.displayTitle ? (
                        <p className="truncate text-xs text-slate-500">{item.fileName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {item.ownerType === "registered" ? (
                        <span className="text-sm text-slate-700">{item.userEmail ?? item.userId}</span>
                      ) : (
                        <Badge variant="outline">Guest</Badge>
                      )}
                      {item.isExpired ? (
                        <Badge variant="outline" className="ml-2 border-amber-200 text-amber-700">
                          Expired
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {formatDuration(item.processedDurationMs ?? item.sourceDurationMs)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          getStatusBadgeClassName(item.status)
                        )}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{item.publicId}</TableCell>
                    <TableCell>
                      {item.hasSourceMedia ? (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/api/admin/transcriptions/${item.publicId}/source`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Download source
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">No source</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="tabular-nums text-slate-500">
                {pagination.totalCount.toLocaleString()}{" "}
                {pagination.totalCount === 1 ? "transcription" : "transcriptions"}
              </p>
              <label className="flex items-center gap-2 text-slate-500">
                <span className="whitespace-nowrap">Rows per page</span>
                <select
                  value={pagination.pageSize}
                  onChange={(event) => handlePageSizeChange(Number(event.target.value))}
                  className={pageSizeSelectClassName}
                  aria-label="Rows per page"
                >
                  {ADMIN_TRANSCRIPTIONS_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              {pagination.hasPrev ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildListHref({
                      ...listState,
                      page: pagination.currentPage - 1,
                    })}
                  >
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              {pagination.hasNext ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildListHref({
                      ...listState,
                      page: pagination.currentPage + 1,
                    })}
                  >
                    Next
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
