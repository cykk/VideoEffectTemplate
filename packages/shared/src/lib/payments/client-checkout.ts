const TOOL_PATH_PATTERNS = [
    /^\/$/,
]

export const PAYMENT_CREDITS_REFRESH_KEY = "payment-credits-refresh"
export const PAYMENT_CREDITS_REFRESH_EVENT = "user-credits:refresh"
export const PAYMENT_CREDITS_SUCCESS_KEY = "payment-credits-success"
export const PAYMENT_CHECKOUT_CONTEXT_KEY = "payment-checkout-context"
export const PAYMENT_LAST_TOOL_RETURN_TO_KEY = "payment-last-tool-return-to"

export interface PaymentCheckoutContext {
    requestId: string
    orderId?: string
    productId?: string
    productType?: "one_time" | "subscription"
    entrySurface?: string
    returnTo?: string | null
    locale?: string
    timestamp: number
}

export function sanitizeLocalReturnTo(value?: string | null): string | null {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
        return null
    }

    return value
}

const PRICING_PATH_PATTERNS = [
  /^\/pricing$/,
]

export function isPricingRoute(pathname: string | null): boolean {
  if (!pathname) {
    return false
  }

  const normalizedPath = pathname !== "/" && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname

  return PRICING_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath))
}

export function persistLastToolReturnPath(returnTo: string | null) {
  if (typeof window === "undefined") {
    return
  }

  const safeReturnTo = sanitizeLocalReturnTo(returnTo)
  if (!safeReturnTo) {
    return
  }

  window.sessionStorage.setItem(
    PAYMENT_LAST_TOOL_RETURN_TO_KEY,
    JSON.stringify({
      returnTo: safeReturnTo,
      timestamp: Date.now(),
    })
  )
}

export function readLastToolReturnPath(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.sessionStorage.getItem(PAYMENT_LAST_TOOL_RETURN_TO_KEY)
  if (!raw) {
    return null
  }

  try {
    const payload = JSON.parse(raw) as { returnTo?: string; timestamp?: number }
    const safeReturnTo = sanitizeLocalReturnTo(payload.returnTo)

    if (!safeReturnTo || Date.now() - (payload.timestamp || 0) > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(PAYMENT_LAST_TOOL_RETURN_TO_KEY)
      return null
    }

    return safeReturnTo
  } catch {
    window.sessionStorage.removeItem(PAYMENT_LAST_TOOL_RETURN_TO_KEY)
    return null
  }
}

export function isToolRoute(pathname: string | null): boolean {
    if (!pathname) {
        return false
    }

    const normalizedPath = pathname !== "/" && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname

    return TOOL_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath))
}

export function resolveCheckoutReturnPath(
    pathname: string | null,
    search?: string | null,
): string | null {
    if (!pathname) {
        return null
    }

    const normalizedPath = pathname !== "/" && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname

    if (!TOOL_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
        return null
    }

    const normalizedSearch = search && search.length > 0
        ? (search.startsWith("?") ? search : `?${search}`)
        : ""

    return sanitizeLocalReturnTo(`${normalizedPath}${normalizedSearch}`)
}

export function markCreditsRefreshPending() {
    if (typeof window === "undefined") {
        return
    }

    window.sessionStorage.setItem(
        PAYMENT_CREDITS_REFRESH_KEY,
        JSON.stringify({ timestamp: Date.now() })
    )
    window.dispatchEvent(new Event(PAYMENT_CREDITS_REFRESH_EVENT))
}

export function markCreditsSuccessPending() {
    if (typeof window === "undefined") {
        return
    }

    window.sessionStorage.setItem(
        PAYMENT_CREDITS_SUCCESS_KEY,
        JSON.stringify({ timestamp: Date.now() })
    )
}

export function persistCheckoutContext(context: Omit<PaymentCheckoutContext, "timestamp">) {
    if (typeof window === "undefined") {
        return
    }

    window.sessionStorage.setItem(
        PAYMENT_CHECKOUT_CONTEXT_KEY,
        JSON.stringify({
            ...context,
            timestamp: Date.now(),
        } satisfies PaymentCheckoutContext)
    )
}

export function readCheckoutContext(): PaymentCheckoutContext | null {
    if (typeof window === "undefined") {
        return null
    }

    const raw = window.sessionStorage.getItem(PAYMENT_CHECKOUT_CONTEXT_KEY)
    if (!raw) {
        return null
    }

    try {
        const payload = JSON.parse(raw) as PaymentCheckoutContext
        if (Date.now() - (payload.timestamp || 0) > 30 * 60 * 1000) {
            window.sessionStorage.removeItem(PAYMENT_CHECKOUT_CONTEXT_KEY)
            return null
        }

        return payload
    } catch {
        window.sessionStorage.removeItem(PAYMENT_CHECKOUT_CONTEXT_KEY)
        return null
    }
}

export function clearCheckoutContext() {
    if (typeof window === "undefined") {
        return
    }

    window.sessionStorage.removeItem(PAYMENT_CHECKOUT_CONTEXT_KEY)
}

export function consumeCreditsRefreshPending(): boolean {
    if (typeof window === "undefined") {
        return false
    }

    const raw = window.sessionStorage.getItem(PAYMENT_CREDITS_REFRESH_KEY)
    if (!raw) {
        return false
    }

    window.sessionStorage.removeItem(PAYMENT_CREDITS_REFRESH_KEY)

    try {
        const payload = JSON.parse(raw) as { timestamp?: number }
        return Date.now() - (payload.timestamp || 0) < 5 * 60 * 1000
    } catch {
        return true
    }
}

export function consumeCreditsSuccessPending(): boolean {
    if (typeof window === "undefined") {
        return false
    }

    const raw = window.sessionStorage.getItem(PAYMENT_CREDITS_SUCCESS_KEY)
    if (!raw) {
        return false
    }

    window.sessionStorage.removeItem(PAYMENT_CREDITS_SUCCESS_KEY)

    try {
        const payload = JSON.parse(raw) as { timestamp?: number }
        return Date.now() - (payload.timestamp || 0) < 5 * 60 * 1000
    } catch {
        return true
    }
}
