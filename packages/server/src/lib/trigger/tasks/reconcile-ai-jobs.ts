import { schedules } from '@trigger.dev/sdk/v3'
import { reconcileAiJobs } from '@markless/server/src/lib/ai/jobs'

export const reconcileAiJobsTask = schedules.task({
  id: 'reconcile-ai-jobs',
  maxDuration: 300,
  cron: { pattern: '*/5 * * * *', timezone: 'UTC', environments: ['PRODUCTION'] },
  run: async () => {
    const result = await reconcileAiJobs()
    if (!('disabled' in result) && (result.failed > 0 || result.unresolved > 0))
      throw new Error('AI job reconciliation requires attention')
    return result
  },
})
