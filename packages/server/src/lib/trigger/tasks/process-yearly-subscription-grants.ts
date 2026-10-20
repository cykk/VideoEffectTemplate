import { queue, schedules } from "@trigger.dev/sdk/v3";
import { processYearlySubscriptionCreditGrants } from "@markless/server/src/lib/subscriptions/yearly-credit-grant";
import { RUN_PROCESS_YEARLY_SUBSCRIPTION_GRANTS_TASK_ID } from "@markless/shared/src/lib/trigger/task-ids";

const yearlyGrantsQueue = queue({
  name: "billing-process-yearly-subscription-grants",
  concurrencyLimit: 1,
});

export const runProcessYearlySubscriptionGrantsTask = schedules.task({
  id: RUN_PROCESS_YEARLY_SUBSCRIPTION_GRANTS_TASK_ID,
  queue: yearlyGrantsQueue,
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
  },
  cron: {
    pattern: "7 * * * *",
    timezone: "UTC",
    environments: ["PRODUCTION"],
  },
  run: async (payload) => {
    const result = await processYearlySubscriptionCreditGrants();

    return {
      scheduleId: payload.scheduleId,
      timestamp: payload.timestamp,
      ranAt: new Date().toISOString(),
      result,
    };
  },
});
