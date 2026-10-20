"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAdminResource } from "@/components/admin/use-admin-resource";
import { formatSubscriptionBillingIntervalLabel } from "@markless/shared/src/lib/subscriptions/admin-plan-label";

type AdminUserSubscriptionSummary = {
  id: string;
  planLabel: string;
  status: string;
  provider: string;
  interval: string;
  currentPeriodEnd: string | Date | null;
};

type AdminUsersData = {
  rows: Array<{
    id: string;
    email: string;
    totalCredits: number;
    remainingCredits: number;
    spentCredits: number;
    createdAt: string | Date | null;
    subscription: AdminUserSubscriptionSummary | null;
  }>;
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

export function AdminUsersPage() {
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") ?? "1";
  const parsedPage = Number.parseInt(pageParam, 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const { data, loading, error, reload } = useAdminResource<AdminUsersData>(
    `/api/admin/users?page=${currentPage}`
  );
  const rows = data?.rows ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalCount: 0,
      totalPages: 1,
      currentPage,
      pageSize: 20,
      hasPrev: false,
      hasNext: false,
    } as AdminUsersData["pagination"]);

  const buildHref = (page: number) => `/admin/users?page=${page}`;
  const buildUserCreditsHref = (userId: string) =>
    `/admin/users/${encodeURIComponent(userId)}/credits`;
  const formatNumber = (value: number) => value.toLocaleString();

  const creditLinkClassName =
    "font-medium text-brand-700 tabular-nums underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-sm";

  const formatBillingInterval = (interval: string | null | undefined) =>
    formatSubscriptionBillingIntervalLabel(interval) ?? interval ?? "-";

  const formatSubscriptionStatus = (status: string) => status.replace(/_/g, " ");

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
      </header>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading users...
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
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableCaption className="text-slate-500">
                Showing {rows.length} of {pagination.totalCount.toLocaleString()} users.
              </TableCaption>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableHead>Email</TableHead>
                  <TableHead>Total Credits</TableHead>
                  <TableHead>Remaining Credits</TableHead>
                  <TableHead>Spent Credits</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="border-slate-200 hover:bg-white">
                    <TableCell colSpan={8} className="text-slate-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((user) => (
                    <TableRow key={user.id} className="border-slate-200 hover:bg-slate-50/70">
                      <TableCell className="font-medium text-slate-900">{user.email}</TableCell>
                      <TableCell className="text-slate-700">
                        <Link
                          href={buildUserCreditsHref(user.id)}
                          className={creditLinkClassName}
                          aria-label={`View credit history for ${user.email}`}
                        >
                          {formatNumber(user.totalCredits)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        <Link
                          href={buildUserCreditsHref(user.id)}
                          className={creditLinkClassName}
                          aria-label={`View credit history for ${user.email}`}
                        >
                          {formatNumber(user.remainingCredits)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-700">{formatNumber(user.spentCredits)}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {user.subscription?.planLabel ?? "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {user.subscription
                          ? formatBillingInterval(user.subscription.interval)
                          : "-"}
                      </TableCell>
                      <TableCell className="capitalize text-slate-700">
                        {user.subscription
                          ? formatSubscriptionStatus(user.subscription.status)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-sm text-slate-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                {pagination.hasPrev ? (
                  <Button asChild variant="outline">
                    <Link href={buildHref(pagination.currentPage - 1)}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Previous
                  </Button>
                )}
                {pagination.hasNext ? (
                  <Button asChild variant="outline">
                    <Link href={buildHref(pagination.currentPage + 1)}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
