import { users } from "./users";
import * as auth from "./auth";
import * as orders from "./orders";
import * as credits from "./credits";
import * as subscriptions from "./subscriptions";
import * as subscriptionLogs from "./subscription-logs";
import * as creditDistributionLogs from "./credit-distribution-logs";
import * as contactMessages from "./contact-messages";
import * as transcriptions from "./transcriptions";
import * as redemptionCodes from "./redemption-codes";
import * as waffo from "./waffo";
import * as aiJobs from "./ai-jobs";
import * as userAttributions from "./user-attributions";

export const schema = {
  users,
  ...auth,
  ...orders,
  ...credits,
  ...subscriptions,
  ...subscriptionLogs,
  ...creditDistributionLogs,
  ...contactMessages,
  ...transcriptions,
  ...redemptionCodes,
  ...waffo,
  ...aiJobs,
  ...userAttributions,
};

export type Schema = typeof schema;

export * from "./users";
export * from "./auth";
export * from "./orders";
export * from "./credits";
export * from "./subscriptions";
export * from "./subscription-logs";
export * from "./credit-distribution-logs";
export * from "./contact-messages";
export * from "./transcriptions";
export * from "./redemption-codes";
export * from "./waffo";
export * from "./ai-jobs";
export * from "./user-attributions";
