"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminResource } from "@/components/admin/use-admin-resource";
import { cn } from "@markless/shared/src/lib/utils";
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription";
import { formatSubscriptionBillingIntervalLabel } from "@markless/shared/src/lib/subscriptions/admin-plan-label";

const PAGE_SIZES = [10, 20, 30, 50] as const;

const SUBSCRIPTION_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.EXPIRED,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.PAUSED,
] as const;

const filterFieldFocusClassName =
  "focus:border-slate-400 focus:ring-0 focus-visible:border-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none";

const filterSelectClassName = cn(
  "h-9 min-w-[10rem] rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none",
  filterFieldFocusClassName,
);

const pageSizeSelectClassName = cn(
  "h-8 w-16 shrink-0 rounded-md border border-input bg-white px-2 text-center text-sm tabular-nums shadow-xs transition-[color,box-shadow] outline-none",
  filterFieldFocusClassName,
);

function formatSubscriptionStatusLabel(status: string): string {
  if (status === SUBSCRIPTION_STATUS.PAST_DUE) {
    return "Past due";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSubscriptionBillingInterval(interval: string | null): string {
  return formatSubscriptionBillingIntervalLabel(interval) ?? interval ?? "-";
}

type AdminSubscriptionsData = {
  rows: Array<{
    id: string;
    userEmail: string | null;
    planLabel: string;
    status: string;
    provider: string | null;
    interval: string | null;
    currentPeriodEnd: string | Date | null;
    createdAt: string | Date | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function AdminSubscriptionsPage() {
  const [emailDraft, setEmailDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (email) params.set("email", email);
    if (status) params.set("status", status);
    return `/api/admin/subscriptions?${params.toString()}`;
  }, [email, page, pageSize, status]);

  const { data, loading, error, reload } =
    useAdminResource<AdminSubscriptionsData>(query);
  const rows = data?.rows ?? [];
  const pagination = data?.pagination ?? {
    page,
    pageSize,
    total: 0,
    totalPages: 1,
  };

  const applySearch = () => {
    setEmail(emailDraft.trim());
    setStatus(statusDraft);
    setPage(1);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch();
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
      </header>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative w-full max-w-[16rem] sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="Filter by email"
            className={cn("pl-9 shadow-none", filterFieldFocusClassName)}
            aria-label="Filter by email"
          />
        </div>
        <select
          value={statusDraft}
          onChange={(event) => setStatusDraft(event.target.value)}
          className={filterSelectClassName}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {SUBSCRIPTION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {formatSubscriptionStatusLabel(value)}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading}>
          Search
        </Button>
      </form>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading subscriptions...
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
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Next billing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-slate-200 hover:bg-white">
                  <TableCell colSpan={6} className="text-slate-500">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((subscription) => (
                  <TableRow key={subscription.id} className="border-slate-200 hover:bg-slate-50/70">
                    <TableCell className="text-slate-700">
                      {subscription.userEmail ?? "-"}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {subscription.planLabel}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {formatSubscriptionBillingInterval(subscription.interval)}
                    </TableCell>
                    <TableCell className="capitalize text-slate-700">
                      {subscription.status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="capitalize text-slate-700">
                      {subscription.provider}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {subscription.currentPeriodEnd
                        ? new Date(subscription.currentPeriodEnd).toLocaleString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="tabular-nums text-slate-500">
                {pagination.total.toLocaleString()}{" "}
                {pagination.total === 1 ? "subscription" : "subscriptions"}
              </p>
              <label className="flex items-center gap-2 text-slate-500">
                <span className="whitespace-nowrap">Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className={pageSizeSelectClassName}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
