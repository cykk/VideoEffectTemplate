import { queue, schedules, task } from '@trigger.dev/sdk/v3'
import { runWaffoOperations } from '@markless/server/src/lib/payments/providers/waffo/operations'
import { processWaffoEvents } from '@markless/server/src/lib/payments/providers/waffo/processor'
import { getEnv } from '@markless/shared/src/lib/config/env'

export const processWaffoInboxTask = task({
  id: 'billing-process-waffo-inbox',
  queue: queue({ name: 'billing-waffo-inbox', concurrencyLimit: 4 }),
  maxDuration: 120, retry: { maxAttempts: 3 },
  run: async () => getEnv('WAFFO_OPERATIONS_ENABLED') === 'true' ? processWaffoEvents() : { disabled: true },
})

export const processWaffoPaymentsTask = schedules.task({
  id: 'billing-process-waffo-payments',
  queue: queue({ name: 'billing-waffo', concurrencyLimit: 1 }),
  maxDuration: 300, retry: { maxAttempts: 3 },
  cron: { pattern: '*/2 * * * *', timezone: 'UTC', environments: ['PRODUCTION'] },
  run: async () => {
    const result = await runWaffoOperations()
    if (!('disabled' in result) && result.before.failed + result.after.failed + result.reconciliation.failed > 0) {
      // Trigger's failed-run notifications surface operational problems without
      // depending on successful delivery of the original payment webhook.
      throw new Error('Waffo operations require attention; inspect the billing inbox and reconciliation dashboard')
    }
    return result
  },
})
