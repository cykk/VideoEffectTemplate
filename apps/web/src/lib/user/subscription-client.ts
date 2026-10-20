import type { CancelSubscriptionModalDictionary } from "@markless/shared/src/i18n/types";
import { apiFetch } from "@markless/shared/src/lib/http/client";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
};

type SubscriptionActionErrors = CancelSubscriptionModalDictionary["errors"];

const SUBSCRIPTION_ERROR_MESSAGE_RESOLVERS: Record<
  string,
  (errors: SubscriptionActionErrors) => string
> = {
  "subscription.visible.error.noActiveSubscription": (errors) =>
    errors.noActiveSubscription,
  "subscription.visible.error.providerCancellationFailed": (errors) =>
    errors.providerCancellationFailed,
  "subscription.visible.error.resumeRequiresScheduledCancellation": (errors) =>
    errors.resumeRequiresScheduledCancellation,
  "subscription.visible.error.resumeExpiredSubscription": (errors) =>
    errors.resumeExpiredSubscription,
  "No active subscription found": (errors) => errors.noActiveSubscription,
  "No scheduled cancellation found": (errors) =>
    errors.noScheduledCancellation,
  "Failed to cancel subscription": (errors) => errors.cancelFailed,
  "Failed to resume subscription": (errors) => errors.resumeFailed,
};

function resolveSubscriptionErrorMessage(
  message: string | undefined,
  errors: SubscriptionActionErrors,
  fallbackMessage: string,
) {
  if (!message) {
    return fallbackMessage;
  }

  const resolver = SUBSCRIPTION_ERROR_MESSAGE_RESOLVERS[message];
  return resolver ? resolver(errors) : fallbackMessage;
}

async function postSubscriptionAction(
  path: string,
  fallbackMessage: string,
  errors: SubscriptionActionErrors,
) {
  try {
    const response = await apiFetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<unknown>
      | null;

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error: resolveSubscriptionErrorMessage(
          payload?.error?.message,
          errors,
          fallbackMessage,
        ),
      };
    }

    return {
      success: true,
    };
  } catch {
    return {
      success: false,
      error: fallbackMessage,
    };
  }
}

export function cancelUserSubscriptionRequest(errors: SubscriptionActionErrors) {
  return postSubscriptionAction(
    "/api/user/subscription/cancel",
    errors.cancelFailed,
    errors,
  );
}

export function resumeUserSubscriptionRequest(errors: SubscriptionActionErrors) {
  return postSubscriptionAction(
    "/api/user/subscription/resume",
    errors.resumeFailed,
    errors,
  );
}
