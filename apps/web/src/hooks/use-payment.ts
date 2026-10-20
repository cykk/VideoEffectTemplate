"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getLocaleFromPathname } from "@markless/shared/src/i18n/locale-config";
import { getProductById } from "@markless/shared/src/lib/products/config";
import {
  isPricingRoute,
  persistCheckoutContext,
  readLastToolReturnPath,
  resolveCheckoutReturnPath,
  sanitizeLocalReturnTo,
} from "@markless/shared/src/lib/payments/client-checkout";
import { toastErrorOptions } from "@markless/shared/src/lib/toast-options";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import { trackStarterCheckoutStarted } from "@/lib/analytics/project";
import { paymentMessage, paymentMessages } from "@markless/shared/src/lib/payments/messages";

interface PaymentRequest {
  product_id: string;
  locale?: string;
  return_to?: string;
}

interface PaymentResponse {
  ok: boolean;
  data?: {
    request_id: string;
    session_id: string;
    checkout_url: string;
    order_id: string;
  };
  message?: string;
}

interface PaymentState {
  isLoading: boolean;
  error: string | null;
  checkoutUrl: string | null;
}

interface CreateCheckoutOptions {
  entrySurface?: string;
  silentFailure?: boolean;
}

const CHECKOUT_REQUEST_TIMEOUT_MS = 15000;

export function usePayment() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PaymentState>({
    isLoading: false,
    error: null,
    checkoutUrl: null,
  });

  const createCheckout = async (
    productId: string,
    options?: CreateCheckoutOptions
  ): Promise<boolean> => {
    setState({
      isLoading: true,
      error: null,
      checkoutUrl: null,
    });

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, CHECKOUT_REQUEST_TIMEOUT_MS);
      try {
        const locale = getLocaleFromPathname(pathname);
        const currentSearch = searchParams?.toString() || "";
        const currentPathWithSearch = sanitizeLocalReturnTo(
          `${pathname}${currentSearch ? `?${currentSearch}` : ""}`
        );
        const explicitReturnTo = sanitizeLocalReturnTo(
          searchParams?.get("return_to")
        );
        const toolReturnTo = resolveCheckoutReturnPath(pathname, currentSearch);
        const rememberedToolReturnTo = readLastToolReturnPath();
        const returnTo =
          toolReturnTo ??
          explicitReturnTo ??
          (isPricingRoute(pathname)
            ? rememberedToolReturnTo ?? currentPathWithSearch
            : null);

        const response = await apiFetch("/api/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            product_id: productId,
            locale,
            ...(returnTo ? { return_to: returnTo } : {}),
          } as PaymentRequest),
        });

        const result: PaymentResponse = await response.json();

        if (!result.ok) {
          throw new Error(result.message?.startsWith('app.payments.') ? paymentMessage(result.message) : result.message || paymentMessages.checkout.error.provider);
        }

        if (!result.data?.checkout_url) {
          throw new Error("Checkout URL is missing");
        }

        setState({
          isLoading: false,
          error: null,
          checkoutUrl: result.data.checkout_url,
        });

        const product = getProductById(productId);

        trackStarterCheckoutStarted({
          entrySurface: options?.entrySurface ?? "unknown",
          productId,
          productType: product?.type,
          value: product?.price,
          currency: product?.currency,
          isAuthenticated: true,
        });

        persistCheckoutContext({
          requestId: result.data.request_id,
          orderId: result.data.order_id,
          productId,
          productType: product?.type,
          entrySurface: options?.entrySurface ?? "unknown",
          returnTo,
          locale,
        });

        window.location.href = result.data.checkout_url;
        return true;
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "Payment request timed out"
          : error instanceof Error
            ? error.message
            : "Payment request failed";

      setState({
        isLoading: false,
        error: errorMessage,
        checkoutUrl: null,
      });

      if (!options?.silentFailure) {
        toast.error(errorMessage, toastErrorOptions);
      }
      return false;
    }
  };

  const reset = () => {
    setState({
      isLoading: false,
      error: null,
      checkoutUrl: null,
    });
  };

  return {
    ...state,
    createCheckout,
    reset,
  };
}
