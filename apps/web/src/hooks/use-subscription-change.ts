import { useState } from 'react'
import { apiFetch } from '@markless/shared/src/lib/http/client'
import { paymentMessage } from '@markless/shared/src/lib/payments/messages'

const SUBSCRIPTION_CHANGE_ERROR_MESSAGE_MAP: Record<string, string> = {
  "subscription.visible.error.noActiveSubscription": "No active subscription found",
  "subscription.visible.error.invalidSubscriptionPlan": "Invalid subscription plan",
  "subscription.visible.error.currentPlanNotFound": "Current subscription plan not found",
  "subscription.visible.error.productInfoNotFound": "Subscription plan details are unavailable",
  "subscription.visible.error.upgradeRequiresHigherTier": "Please choose a higher plan to upgrade",
  "subscription.visible.error.downgradeRequiresLowerTier": "Please choose a lower plan to switch",
  "subscription.visible.error.planUnavailable": "This plan is temporarily unavailable",
  "subscription.visible.error.onlyCreemSupported": "Only Creem subscriptions can be changed right now",
  "subscription.visible.error.previewNotImplemented": "Upgrade preview is not available yet",
  "subscription.visible.error.unsupportedProvider": "This payment provider is not supported",
  "subscription.visible.error.internalPreviewError": "Unable to preview this plan change right now",
  "subscription.visible.error.upgradeRejected": "Unable to upgrade the subscription right now",
  "subscription.visible.error.downgradeFailed": "Unable to change the subscription right now",
}

interface SubscriptionChangeResult {
  status: 'success' | 'error' | 'checkout'
  message: string
  change_type?: 'upgrade' | 'downgrade'
  effective_immediately?: boolean
  effective_date?: string
  subscription?: Record<string, unknown>
}

interface UseSubscriptionChangeReturn {
  changePlan: (newPlanId: string) => Promise<SubscriptionChangeResult | null>
  cancelScheduledChange: () => Promise<boolean>
  isLoading: boolean
  error: string | null
}

function resolveSubscriptionChangeMessage(message?: string | null): string {
  if (!message) {
    return 'Failed to change subscription plan'
  }
  if (message.startsWith('app.payments.')) return paymentMessage(message)

  return SUBSCRIPTION_CHANGE_ERROR_MESSAGE_MAP[message] ?? message
}

/**
 * Hook for managing subscription plan changes (upgrade/downgrade)
 *
 * Usage:
 * ```tsx
 * const { changePlan, cancelScheduledChange, isLoading, error } = useSubscriptionChange()
 *
 * // Change plan
 * const result = await changePlan('tier2:monthly')
 * if (result.status === 'success') {
 *   if (result.change_type === 'upgrade') {
 *     // Upgrade successful, effective immediately
 *     console.log('Upgraded!', result.message)
 *   } else {
 *     // Downgrade scheduled
 *     console.log('Downgrade scheduled for:', result.effective_date)
 *   }
 * }
 *
 * // Cancel scheduled change
 * const cancelled = await cancelScheduledChange()
 * ```
 */
export function useSubscriptionChange(): UseSubscriptionChangeReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Change subscription plan
   * Automatically determines if it's an upgrade or downgrade
   */
  const changePlan = async (newPlanId: string): Promise<SubscriptionChangeResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/subscriptions/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_plan_id: newPlanId,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        const errorMessage = resolveSubscriptionChangeMessage(result.message)
        setError(errorMessage)
        return {
          status: 'error',
          message: errorMessage,
        }
      }

      if (result.data.status === 'checkout' && result.data.checkout_url) {
        window.location.assign(result.data.checkout_url)
        return { status: 'checkout', message: '' }
      }

      return {
        status: 'success',
        message: result.data.message,
        change_type: result.data.change_type,
        effective_immediately: result.data.effective_immediately,
        effective_date: result.data.effective_date,
        subscription: result.data.subscription,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      return {
        status: 'error',
        message: errorMessage,
      }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Cancel a scheduled plan change (downgrade)
   * Returns true if cancellation was successful
   */
  const cancelScheduledChange = async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/subscriptions/change', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        const errorMessage = result.message || 'Failed to cancel scheduled change'
        setError(errorMessage)
        return false
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    changePlan,
    cancelScheduledChange,
    isLoading,
    error,
  }
}
