"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { toastConfirmOptions } from "@markless/shared/src/lib/toast-options";
import { getDictionary } from "@markless/shared/src/i18n";
import { getLocaleFromPathname } from "@markless/shared/src/i18n/locale-config";
import {
    clearCheckoutContext,
    consumeCreditsSuccessPending,
    isToolRoute,
    markCreditsRefreshPending,
    persistLastToolReturnPath,
    readCheckoutContext,
    resolveCheckoutReturnPath,
} from "@markless/shared/src/lib/payments/client-checkout";
import { waitForPayment } from "@/lib/payments/wait-for-payment";
import { paymentMessages } from "@markless/shared/src/lib/payments/messages";
import { trackStarterPurchaseCompleted } from "@/lib/analytics/project";

const PAYMENT_SUCCESS_PARAM = "payment";
const PAYMENT_TYPE_PARAM = "payment_type";
const PAYMENT_REQUEST_ID_PARAM = "payment_request_id";
const PAYMENT_RETURN_TO_PARAM = "return_to";

function clearPaymentSuccessParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete(PAYMENT_SUCCESS_PARAM);
    url.searchParams.delete(PAYMENT_TYPE_PARAM);
    url.searchParams.delete("order_id");
    url.searchParams.delete("request_id");
    url.searchParams.delete("type");
    url.searchParams.delete(PAYMENT_REQUEST_ID_PARAM);
    window.history.replaceState({}, "", url.toString());
}

function getSearchParamsWithoutPaymentSignals(searchParams: URLSearchParams): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(PAYMENT_SUCCESS_PARAM);
    params.delete(PAYMENT_TYPE_PARAM);
    params.delete(PAYMENT_REQUEST_ID_PARAM);
    params.delete(PAYMENT_RETURN_TO_PARAM);
    return params.toString();
}

export function CreditsAddedOverlay() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const locale = getLocaleFromPathname(pathname);
    const dictionary = useMemo(() => getDictionary(locale), [locale]);
    const overlayDictionary = dictionary.tools.payment.creditsSuccess;
    const paymentStatus = searchParams.get(PAYMENT_SUCCESS_PARAM);
    const paymentType = searchParams.get(PAYMENT_TYPE_PARAM);

    useEffect(() => {
        const cleanedSearch = getSearchParamsWithoutPaymentSignals(searchParams);
        const toolReturnTo = resolveCheckoutReturnPath(pathname, cleanedSearch);

        if (toolReturnTo) {
            persistLastToolReturnPath(toolReturnTo);
        }
    }, [pathname, searchParams]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const shouldTriggerFromQuery =
            paymentStatus === "success" &&
            paymentType === "credits";

        const shouldTriggerFromSession =
            isToolRoute(pathname) && consumeCreditsSuccessPending();

        if (!shouldTriggerFromQuery && !shouldTriggerFromSession) {
            return;
        }

        const controller = new AbortController();
        const confirm = async () => {
            try {
                const context = readCheckoutContext();
                if (shouldTriggerFromQuery) {
                    const data = await waitForPayment({
                        request_id: searchParams.get(PAYMENT_REQUEST_ID_PARAM) || context?.requestId,
                        order_id: searchParams.get('order_id') || context?.orderId,
                    }, controller.signal);
                    if (!data) { toast.info(paymentMessages.status.message.pending); return; }
                    trackStarterPurchaseCompleted({
                        dedupeKey: data.order.id, transactionId: data.order.id,
                        value: Number(data.order.amount), currency: data.order.currency,
                        productId: context?.productId, productType: 'one_time',
                        entrySurface: context?.entrySurface,
                    });
                    clearCheckoutContext();
                    clearPaymentSuccessParams();
                }
                if (!controller.signal.aborted) {
                    markCreditsRefreshPending();
                    toast.success(overlayDictionary.card.title, { ...toastConfirmOptions, id: 'credits-payment-success' });
                }
            } catch (error) {
                if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : paymentMessages.status.message.failed);
            }
        };
        void confirm();
        return () => controller.abort();
    }, [overlayDictionary.card.title, pathname, paymentStatus, paymentType, searchParams]);

    return null;
}
