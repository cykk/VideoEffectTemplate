"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { waitForPayment } from "@/lib/payments/wait-for-payment";
import { toast } from "sonner";
import { paymentMessages } from "@markless/shared/src/lib/payments/messages";
import {
  clearCheckoutContext,
  markCreditsRefreshPending,
  readCheckoutContext,
} from "@markless/shared/src/lib/payments/client-checkout";
import { trackStarterPurchaseCompleted } from "@/lib/analytics/project";
import {
  refreshUserBootstrap,
  refreshUserCredits,
} from "@/lib/query/user-query-refresh";

const SUCCESS_QUERY_KEYS = [
  "request_id",
  "checkout_id",
  "order_id",
  "customer_id",
  "product_id",
  "signature",
  "type",
  "upgrade",
  "return_to",
    "payment",
    "payment_type",
    "payment_request_id",
] as const;

function normalizeProductType(
  value: string | null
): "one_time" | "subscription" | undefined {
  if (value === "one_time" || value === "subscription") {
    return value;
  }

  return undefined;
}

function clearPaymentSuccessParams() {
  const url = new URL(window.location.href);

  for (const key of SUCCESS_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  window.history.replaceState({}, "", url.toString());
}

export function DashboardPaymentSuccessHandler() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const requestId = searchParams.get("request_id");
    const orderId = searchParams.get("order_id");
    const type = searchParams.get("type");
    const upgrade = searchParams.get("upgrade");
    const returnTo = searchParams.get("return_to");
    const shouldHandle =
      Boolean(requestId) || Boolean(orderId) || upgrade === "true";

    if (!shouldHandle) {
      return;
    }

    const handledKey = [
      pathname,
      requestId ?? "",
      orderId ?? "",
      type ?? "",
      upgrade ?? "",
      returnTo ?? "",
    ].join("|");

    if (handledKeyRef.current === handledKey) {
      return;
    }

    handledKeyRef.current = handledKey;
    let cancelled = false;
    const controller = new AbortController();

    const handlePaymentSuccess = async () => {
      try {
        const checkoutContext = readCheckoutContext();
        const data = await waitForPayment({
            request_id: requestId ?? checkoutContext?.requestId,
            order_id: orderId ?? checkoutContext?.orderId,
            type: type ?? checkoutContext?.productType,
            upgrade: upgrade === "true",
            return_to: returnTo ?? checkoutContext?.returnTo ?? undefined,
          }, controller.signal);
        if (!data) {
          toast.info(paymentMessages.status.message.pending);
          return;
        }

        if (cancelled) {
          return;
        }

        const normalizedProductType = normalizeProductType(
          type ?? checkoutContext?.productType ?? null
        );

        if (data.scheduled) toast.info(paymentMessages.status.message.scheduled);
        else trackStarterPurchaseCompleted({
          dedupeKey: `${data.order.id}:${normalizedProductType ?? "unknown"}`,
          transactionId: data.order.id,
          value: Number(data.order.amount),
          currency: data.order.currency,
          productId: checkoutContext?.productId,
          productName: data.order.productName,
          productType: normalizedProductType,
          entrySurface: checkoutContext?.entrySurface ?? "dashboard_page",
        });

        clearCheckoutContext();
        clearPaymentSuccessParams();
        markCreditsRefreshPending();
        await Promise.all([
          refreshUserBootstrap(queryClient),
          refreshUserCredits(queryClient),
        ]);
        router.refresh();
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : paymentMessages.status.message.failed);
        console.error("[DashboardPaymentSuccessHandler] Failed to settle payment", error);
        handledKeyRef.current = null;
      }
    };

    void handlePaymentSuccess();

    return () => {
      cancelled = true;
      controller.abort();
      if (handledKeyRef.current === handledKey) handledKeyRef.current = null;
    };
  }, [pathname, queryClient, router, searchParams]);

  return null;
}
