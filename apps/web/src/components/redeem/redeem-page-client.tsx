"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorCode } from "@markless/shared/src/types/api/video";
import type { RedeemPageDictionary } from "@markless/shared/src/i18n/types";
import { DEFAULT_APPSUMO_CREDITS } from "@markless/shared/src/lib/redemption/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { useLocale } from "@/hooks/use-locale";
import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { buildDashboardUrl } from "@/hooks/use-auth-action";
import { formatAppNumber } from "@/lib/formatters";

type RedemptionStatus = {
  enabled: boolean;
  codesRedeemed: number;
  maxCodes: number;
  totalCreditsFromAppsumo: number;
  canRedeemMore: boolean;
  creditsPerCode: number;
};

type RedeemSuccess = {
  creditsGranted: number;
  totalBalance: number;
  appsumoCodesRedeemed: number;
  appsumoCodesRemaining: number;
};

function formatRedeemCopy(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

function resolveErrorMessage(
  dict: RedeemPageDictionary,
  code?: ApiErrorCode
): string {
  switch (code) {
    case "REDEMPTION_INVALID_CODE":
      return dict.errors.invalidCode;
    case "REDEMPTION_ALREADY_REDEEMED":
      return dict.errors.alreadyRedeemed;
    case "REDEMPTION_CODE_REVOKED":
      return dict.errors.revoked;
    case "REDEMPTION_STACK_LIMIT_REACHED":
      return dict.errors.stackLimit;
    case "RATE_LIMITED":
      return dict.errors.rateLimited;
    default:
      return dict.errors.generic;
  }
}

export function RedeemPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dictionary } = useLocale();
  const dict = dictionary.pages.redeem;
  const { data: bootstrap, loading: isBootstrapLoading } = useUserBootstrap();

  const initialCode = searchParams.get("code") ?? "";
  const [code, setCode] = useState(initialCode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);
  const [status, setStatus] = useState<RedemptionStatus | null>(null);

  const isAuthenticated = bootstrap?.authenticated ?? false;
  const creditsPerCode = status?.creditsPerCode ?? DEFAULT_APPSUMO_CREDITS;
  const isAtStackLimit = isAuthenticated && status !== null && !status.canRedeemMore;

  const returnPath = useMemo(() => {
    const params = new URLSearchParams();
    if (code.trim()) {
      params.set("code", code.trim());
    }
    const query = params.toString();
    return query ? `/redeem?${query}` : "/redeem";
  }, [code]);

  const loginHref = `/login?returnTo=${encodeURIComponent(returnPath)}`;
  const signupHref = `/signup?returnTo=${encodeURIComponent(returnPath)}`;
  const dashboardHref = buildDashboardUrl(locale);

  const footnote = formatRedeemCopy(dict.footnote, {
    credits: formatAppNumber(creditsPerCode, locale),
  });

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await apiFetch("/api/redemption/status");
        const payload = await response.json();

        if (!cancelled && payload.success) {
          setStatus(payload.data as RedemptionStatus);
        }
      } catch (error) {
        console.error("[Redeem] Failed to load status:", error);
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, success]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setErrorMessage(dict.errors.emptyCode);
      return;
    }

    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/redemption/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const payload = await response.json();

      if (!payload.success) {
        setErrorMessage(resolveErrorMessage(dict, payload.error?.code));
        return;
      }

      setSuccess(payload.data as RedeemSuccess);
    } catch (error) {
      console.error("[Redeem] Submit failed:", error);
      setErrorMessage(dict.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel = isAuthenticated ? dict.form.submit : dict.form.submitGuest;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col items-center">
          <Link href={locale === "en" ? "/" : `/${locale}`} className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
        </div>

        <section className="w-full rounded-2xl border border-border bg-card shadow-2xl">
          <header className="border-b border-slate-100/80 px-8 pb-5 pt-8 text-center sm:px-9 sm:pt-9">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.title}</h1>
          </header>

          <div className="space-y-5 px-8 py-8 sm:px-9">
            {success ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {formatRedeemCopy(dict.success.title, {
                      credits: formatAppNumber(success.creditsGranted, locale),
                    })}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatRedeemCopy(dict.success.balance, {
                      balance: formatAppNumber(success.totalBalance, locale),
                    })}
                  </p>
                </div>
                <Button asChild className="min-h-11 w-full">
                  <Link href={dashboardHref}>{dict.success.cta}</Link>
                </Button>
              </div>
            ) : isAtStackLimit ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-slate-600">{dict.stackLimitReached}</p>
                <Button asChild className="min-h-11 w-full">
                  <Link href={dashboardHref}>{dict.success.cta}</Link>
                </Button>
              </div>
            ) : (
              <>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label htmlFor="redemption-code" className="text-sm font-medium text-foreground">
                      {dict.form.codeLabel}
                    </label>
                    <Input
                      id="redemption-code"
                      name="code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                      placeholder={dict.form.codePlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-h-11 font-mono uppercase tracking-wide"
                      disabled={isSubmitting}
                    />
                  </div>

                  {errorMessage ? (
                    <p className="text-sm text-destructive" role="alert">
                      {errorMessage}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="min-h-11 w-full"
                    disabled={isSubmitting || isBootstrapLoading}
                  >
                    {isSubmitting ? dict.form.submitting : submitLabel}
                  </Button>

                  <p className="text-center text-xs text-slate-500">{footnote}</p>

                  {!isBootstrapLoading && !isAuthenticated ? (
                    <p className="text-center text-sm text-slate-500">
                      <Link href={signupHref} className="font-medium text-primary hover:underline">
                        {dict.auth.createAccount}
                      </Link>
                    </p>
                  ) : null}
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
