import { db } from "@markless/server/src/lib/db/client"
import { userSubscriptions } from "@markless/server/src/lib/db/schema/subscriptions"
import { eq, and, desc } from "drizzle-orm"
import { getProductById } from "@markless/shared/src/lib/products/config"
import { SUBSCRIPTION_STATUS } from "@markless/shared/src/constants/subscription"

export async function getUserSubscriptionData(userId: string) {
  // Find active subscriptions (cancel-at-period-end stays active)
  const subscription = await db.query.userSubscriptions.findFirst({
    where: and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, SUBSCRIPTION_STATUS.ACTIVE)
      ),
    orderBy: [desc(userSubscriptions.currentPeriodEnd)],
  });

  if (!subscription) return null;

  const product = getProductById(subscription.planId);
  const price = product?.type === 'subscription' ? product.price : 0;

  return {
    ...subscription,
    price,
  };
}
