"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Receipt, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { useApiResource } from "@/hooks/use-api-resource";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@markless/shared/src/i18n/types";
import { paymentMessages } from "@markless/shared/src/lib/payments/messages";
import { formatAppCurrency } from "@/lib/formatters";

type OrdersHistoryData = {
  data: Array<{
    id: string;
    orderNumber: string;
    date: string;
    product: string;
    period: string | null;
    amount: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    paymentMethod: string;
    receipts?: Array<{ id: string; charged: string | null; tax: string | null; refunded: string; currency: string }>;
  }>;
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

export function OrdersPageClient({ locale }: { locale: Locale }) {
  const { dictionary } = useLocale();
  const billingDict = dictionary.pages.membership.billingHistory;
  const paginationDict = dictionary.pages.orders.pagination;
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") ?? "1";
  const parsedPage = parseInt(pageParam, 10);
  const currentPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const { data } = useApiResource<OrdersHistoryData>(
    `/api/user/orders/history?page=${currentPage}&locale=${locale}`
  );

  const ordersData = data?.data ?? [];
  const pagination =
    data?.pagination ??
    ({
      totalCount: 0,
      totalPages: 1,
      currentPage,
      hasPrev: false,
      hasNext: false,
    } as OrdersHistoryData["pagination"]);

  const buildHref = (page: number) =>
    locale === "en" ? `/Settings/orders?page=${page}` : `/${locale}/Settings/orders?page=${page}`;

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">{billingDict.title}</h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400">{billingDict.pageDescription}</p>
      </div>

      <div className="space-y-4">
        {ordersData.map((order) => (
          <div
            key={order.id}
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-6 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 hidden sm:block">
                  <Receipt className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{order.product}</h3>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${order.statusColor}`}>
                      {order.statusLabel}
                    </span>
                  </div>

                  <div className="text-sm text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{order.date}</span>
                    {order.period && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                        <span>{order.period}</span>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-neutral-400 flex items-center gap-2">
                    <CreditCard className="w-3 h-3" />
                    <span>{order.paymentMethod}</span>
                    <span className="w-0.5 h-3 bg-neutral-200 dark:bg-neutral-700" />
                    <span className="font-mono text-[10px]">{order.orderNumber}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-4 sm:border-l sm:border-neutral-100 sm:dark:border-neutral-800">
                <div className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{order.amount}</div>
              </div>
            </div>
            {order.receipts?.map(receipt => <div key={receipt.id} className="mt-3 border-t pt-2 text-sm">
              <p>{paymentMessages.history.label.receipt}: {receipt.id}</p>
              <p>{paymentMessages.history.label.charged}: {receipt.charged === null ? paymentMessages.history.label.unconfirmed : formatAppCurrency(Number(receipt.charged), receipt.currency, locale)}</p>
              <p>{paymentMessages.history.label.tax}: {receipt.tax === null ? paymentMessages.history.label.unconfirmed : formatAppCurrency(Number(receipt.tax), receipt.currency, locale)}</p>
              <p>{paymentMessages.history.label.refunded}: {formatAppCurrency(Number(receipt.refunded), receipt.currency, locale)}</p>
            </div>)}
          </div>
        ))}
      </div>

      {ordersData.length === 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-12 text-center">
          <Receipt className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
          <p className="text-base text-neutral-500 dark:text-neutral-400">{billingDict.noRecords}</p>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {pagination.hasPrev ? (
            <Link
              href={buildHref(pagination.currentPage - 1)}
              className="inline-flex items-center justify-center h-9 px-4 gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{paginationDict.previous}</span>
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center h-9 px-4 gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-700 dark:text-neutral-300 opacity-40 cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{paginationDict.previous}</span>
            </div>
          )}

          <div className="mx-4 flex items-center gap-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 min-w-[2rem] text-center">
              {pagination.currentPage}
            </span>
            <span className="text-neutral-400 dark:text-neutral-600">/</span>
            <span>{pagination.totalPages}</span>
          </div>

          {pagination.hasNext ? (
            <Link
              href={buildHref(pagination.currentPage + 1)}
              className="inline-flex items-center justify-center h-9 px-4 gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all shadow-sm"
            >
              <span className="hidden sm:inline">{paginationDict.next}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="inline-flex items-center justify-center h-9 px-4 gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm font-medium text-neutral-700 dark:text-neutral-300 opacity-40 cursor-not-allowed">
              <span className="hidden sm:inline">{paginationDict.next}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

