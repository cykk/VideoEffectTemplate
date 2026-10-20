"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { AdminUserCreditsDetailResponse } from "@markless/shared/src/lib/credits/admin-user-credits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAdminResource } from "@/components/admin/use-admin-resource";

function parsePageParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function formatTransactionType(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDescription(description: string | null, type: string): string {
  if (description?.trim()) {
    return description.trim();
  }
  return formatTransactionType(type);
}

function buildCreditsHref(userId: string, page: number): string {
  return `/admin/users/${encodeURIComponent(userId)}/credits?page=${page}`;
}

function buildTranscriptionsHref(publicId: string): string {
  const params = new URLSearchParams({ q: publicId, page: "1", pageSize: "20" });
  return `/admin/transcriptions?${params.toString()}`;
}

export function AdminUserCreditsPage() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params.userId;
  const currentPage = parsePageParam(searchParams.get("page"));

  const { data, loading, error, reload } = useAdminResource<AdminUserCreditsDetailResponse>(
    `/api/admin/users/${encodeURIComponent(userId)}/credits?page=${currentPage}`
  );

  const formatNumber = (value: number) => value.toLocaleString();
  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-slate-600">
          <Link href="/admin/users">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Users
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Credit history</h1>
          {data?.user.email ? (
            <p className="mt-1 text-sm text-slate-600">{data.user.email}</p>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            Loading credit history...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Remaining
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.total)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.subscription)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pack</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.purchased)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bonus</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.bonus)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total earned
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.totalEarned)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total spent
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatNumber(data.balance.totalSpent)}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Transaction list reflects recorded credit_transactions entries.
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.length === 0 ? (
                  <TableRow className="border-slate-200 hover:bg-white">
                    <TableCell colSpan={6} className="text-slate-500">
                      No credit transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.transactions.map((row) => {
                    const isCredit = row.amount > 0;
                    return (
                      <TableRow key={row.id} className="border-slate-200 hover:bg-slate-50/70">
                        <TableCell className="whitespace-nowrap text-slate-700">
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize text-slate-700">
                          {formatTransactionType(row.type)}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-slate-700">
                          {formatDescription(row.description, row.type)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
                            isCredit ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {isCredit ? "+" : ""}
                          {formatNumber(row.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-700">
                          {formatNumber(row.balanceAfter)}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {row.referencePublicId ? (
                            <Link
                              href={buildTranscriptionsHref(row.referencePublicId)}
                              className="font-medium text-brand-700 hover:underline"
                            >
                              Job {row.referencePublicId}
                            </Link>
                          ) : row.orderId ? (
                            <span className="font-mono text-xs text-slate-600" title={row.orderId}>
                              Order {row.orderId.slice(0, 8)}…
                            </span>
                          ) : row.subscriptionId ? (
                            <span className="font-mono text-xs text-slate-600" title={row.subscriptionId}>
                              Sub {row.subscriptionId.slice(0, 8)}…
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-sm text-slate-600">
                Page {pagination.currentPage} of {pagination.totalPages} (
                {pagination.totalCount.toLocaleString()} transactions)
              </div>
              <div className="flex items-center gap-2">
                {pagination.hasPrev ? (
                  <Button asChild variant="outline">
                    <Link href={buildCreditsHref(userId, pagination.currentPage - 1)}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Previous
                  </Button>
                )}
                {pagination.hasNext ? (
                  <Button asChild variant="outline">
                    <Link href={buildCreditsHref(userId, pagination.currentPage + 1)}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
