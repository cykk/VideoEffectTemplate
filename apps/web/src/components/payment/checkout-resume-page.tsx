"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { usePayment } from "@/hooks/use-payment";
import {
  buildPricingUrl,
  buildDashboardUrl,
  clearPendingCheckoutContext,
  clearPostAuthIntent,
  readPendingCheckoutContext,
  readPostAuthIntent,
} from "@/hooks/use-auth-action";

export function CheckoutResumePage() {
  const router = useRouter();
  const { locale, dictionary } = useLocale();
  const { data: bootstrap, loading: bootstrapLoading, isFetched: bootstrapFetched } =
    useUserBootstrap();
  const { createCheckout } = usePayment();
  const pageDict = dictionary.pages.checkoutResume;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const handleBack = useCallback(() => {
    const pendingCheckout = readPendingCheckoutContext();
    const fallbackUrl = buildPricingUrl(locale);
    const targetUrl =
      pendingCheckout?.returnTo && pendingCheckout.returnTo.startsWith("/")
        ? pendingCheckout.returnTo
        : fallbackUrl;

    clearPendingCheckoutContext();
    clearPostAuthIntent();
    router.replace(targetUrl);
  }, [locale, router]);

  const resumeCheckout = useCallback(async () => {
    const pendingCheckout = readPendingCheckoutContext();

    if (!pendingCheckout) {
      clearPendingCheckoutContext();
      clearPostAuthIntent();
      setErrorMessage(pageDict.errors.missingContext);
      return;
    }

    setErrorMessage(null);

    const success = await createCheckout(pendingCheckout.productId, {
      entrySurface: pendingCheckout.entrySurface,
      silentFailure: true,
    });

    if (success) {
      clearPendingCheckoutContext();
      clearPostAuthIntent();
      return;
    }

    setErrorMessage(pageDict.errors.createCheckoutFailed);
  }, [
    createCheckout,
    pageDict.errors.createCheckoutFailed,
    pageDict.errors.missingContext,
  ]);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    const pendingCheckout = readPendingCheckoutContext();
    const postAuthIntent = readPostAuthIntent();

    if (!pendingCheckout || postAuthIntent !== "resume_checkout") {
      hasStartedRef.current = true;
      clearPendingCheckoutContext();
      clearPostAuthIntent();
      setErrorMessage(pageDict.errors.missingContext);
      return;
    }

    if (bootstrapLoading || !bootstrapFetched) {
      return;
    }

    if (!bootstrap?.authenticated) {
      hasStartedRef.current = true;
      clearPostAuthIntent();
      router.replace(buildDashboardUrl(locale));
      return;
    }

    hasStartedRef.current = true;

    void resumeCheckout();
  }, [
    bootstrap?.authenticated,
    bootstrapFetched,
    bootstrapLoading,
    locale,
    pageDict.errors.missingContext,
    resumeCheckout,
    router,
  ]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {errorMessage ? (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-slate-900">
              {pageDict.errorTitle}
            </h1>
            <p className="text-sm leading-6 text-slate-500">{errorMessage}</p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              <Button onClick={() => void resumeCheckout()}>
                {pageDict.actions.tryAgain}
              </Button>
              <Button variant="outline" onClick={handleBack}>
                {pageDict.actions.back}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <LoaderCircle className="mx-auto size-8 animate-spin text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-slate-900">
              {pageDict.title}
            </h1>
            <p className="text-sm leading-6 text-slate-500">{pageDict.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
