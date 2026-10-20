import { db } from "@markless/server/src/lib/db/client"
import type { DrizzleClient } from "@markless/server/src/lib/db/client"
import {
    userCredits,
    creditTransactions,
    type UserCredit,
    type NewUserCredit,
    type CreditTransaction,
    type NewCreditTransaction,
} from "@markless/server/src/lib/db/schema/credits"
import { eq, desc, sql } from "drizzle-orm"
import { nanoid } from "nanoid"

type DbTransaction = Parameters<Parameters<DrizzleClient["transaction"]>[0]>[0]
type DbClient = DrizzleClient | DbTransaction

/**
 * 积分管理服务
 */
export class CreditService {
    static extractBreakdown(metadata: unknown): { subscription: number; bonus: number; purchased: number } | null {
        if (!metadata || typeof metadata !== "object") return null;
        const raw = (metadata as { breakdown?: Record<string, unknown> }).breakdown;
        if (!raw || typeof raw !== "object") return null;
        const breakdown = raw as Record<string, unknown>;
        const subscription = Math.max(0, Number(breakdown.subscription) || 0);
        const bonus = Math.max(0, Number(breakdown.bonus) || 0);
        const purchased = Math.max(0, Number(breakdown.purchased) || 0);
        const total = subscription + bonus + purchased;
        if (total <= 0) return null;
        return { subscription, bonus, purchased };
    }
    /**
     * 获取或创建用户积分账户
     * 
     * ✅ P0 FIX: 支持事务参数
     */
    static async getOrCreateUserCredits(userId: string, dbClient?: DbClient): Promise<UserCredit> {
        const client = dbClient || db;

        // 尝试获取现有账户
        const [existing] = await client
            .select()
            .from(userCredits)
            .where(eq(userCredits.userId, userId))
            .limit(1)

        if (existing) {
            return existing
        }

        // 创建新账户
        const newAccount: NewUserCredit = {
            id: nanoid(),
            userId,
            subscriptionCredits: 0,
            purchasedCredits: 0,
            bonusCredits: 0,
            totalBalance: 0,
            totalEarned: 0,
            totalSpent: 0,
        }

        const [account] = await client.insert(userCredits).values(newAccount).returning()
        return account
    }

    /**
     * 发放积分
     * 
     * ✅ P0 FIX: 支持事务参数，确保与外部操作的原子性
     */
    static async grantCredits({
        userId,
        amount,
        source,
        type,
        orderId,
        subscriptionId,
        description,
        metadata,
        expiresAt,
        idempotencyKey,
        tx,
    }: {
        userId: string
        amount: number
        source: "subscription" | "one_time" | "bonus"
        type: "subscription_grant" | "subscription_upgrade" | "purchase" | "bonus" | "adjustment"
        orderId?: string
        subscriptionId?: string
        description?: string
        metadata?: Record<string, unknown>
        expiresAt?: Date
        idempotencyKey?: string
        tx?: DbClient // ✅ 可选的 Drizzle 事务对象
    }): Promise<{ account: UserCredit; transaction: CreditTransaction }> {
        const runGrant = async (
            dbClient: DbClient
        ): Promise<{ account: UserCredit; transaction: CreditTransaction }> => {
            // Ensure account exists, then lock the row for atomic updates
            await this.getOrCreateUserCredits(userId, dbClient)

            const [account] = await dbClient
                .select()
                .from(userCredits)
                .where(eq(userCredits.userId, userId))
                .limit(1)
                .for("update")

            if (!account) {
                throw new Error("Credit account not found after creation")
            }

            const newTotalBalance = account.totalBalance + amount
            const transaction: NewCreditTransaction = {
                id: nanoid(),
                userId,
                type,
                amount,
                balanceAfter: newTotalBalance,
                source,
                orderId,
                subscriptionId,
                idempotencyKey,
                expiresAt,
                description,
                metadata: metadata ?? {},
            }

            if (idempotencyKey) {
                const created = await dbClient
                    .insert(creditTransactions)
                    .values(transaction)
                    .onConflictDoNothing()
                    .returning()

                if (created.length === 0) {
                    const [existingTx] = await dbClient
                        .select()
                        .from(creditTransactions)
                        .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
                        .limit(1)

                    if (!existingTx) {
                        throw new Error("Idempotency conflict but transaction not found")
                    }

                    return { account, transaction: existingTx }
                }

                const [updatedAccount] = await dbClient
                    .update(userCredits)
                    .set({
                        ...(source === "subscription" && {
                            subscriptionCredits: sql`${userCredits.subscriptionCredits} + ${amount}`,
                        }),
                        ...(source === "one_time" && {
                            purchasedCredits: sql`${userCredits.purchasedCredits} + ${amount}`,
                        }),
                        ...(source === "bonus" && {
                            bonusCredits: sql`${userCredits.bonusCredits} + ${amount}`,
                        }),
                        totalBalance: sql`${userCredits.totalBalance} + ${amount}`,
                        totalEarned: sql`${userCredits.totalEarned} + ${amount}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(userCredits.userId, userId))
                    .returning()

                const createdTransaction = created[0]

                console.log("[CreditService] Credits granted:", {
                    userId,
                    amount,
                    source,
                    type,
                    newBalance: newTotalBalance,
                    inTransaction: !!tx,
                })

                return { account: updatedAccount, transaction: createdTransaction }
            }

            const [updatedAccount] = await dbClient
                .update(userCredits)
                .set({
                    ...(source === "subscription" && {
                        subscriptionCredits: sql`${userCredits.subscriptionCredits} + ${amount}`,
                    }),
                    ...(source === "one_time" && {
                        purchasedCredits: sql`${userCredits.purchasedCredits} + ${amount}`,
                    }),
                    ...(source === "bonus" && {
                        bonusCredits: sql`${userCredits.bonusCredits} + ${amount}`,
                    }),
                    totalBalance: sql`${userCredits.totalBalance} + ${amount}`,
                    totalEarned: sql`${userCredits.totalEarned} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(userCredits.userId, userId))
                .returning()

            const [createdTransaction] = await dbClient
                .insert(creditTransactions)
                .values(transaction)
                .returning()

            console.log("[CreditService] Credits granted:", {
                userId,
                amount,
                source,
                type,
                newBalance: newTotalBalance,
                inTransaction: !!tx,
            })

            return { account: updatedAccount, transaction: createdTransaction }
        }

        if (tx) {
            return await runGrant(tx)
        }

        return await db.transaction(async (innerTx) => runGrant(innerTx))
    }

    /**
     * 扣除积分（按优先级：订阅 > 赠送 > 充值）
     * ✅ P1 FIX: Uses database transaction for atomicity
     */
    static async deductCredits({
        userId,
        amount,
        description,
        metadata,
        idempotencyKey,
    }: {
        userId: string
        amount: number
        description?: string
        metadata?: Record<string, unknown>
        idempotencyKey?: string
    }): Promise<{ account: UserCredit; transaction: CreditTransaction; breakdown: { subscription: number; bonus: number; purchased: number } }> {
        // ✅ P1 FIX: Use transaction to ensure atomicity
        return await db.transaction(async (tx) => {
            // Get account with row-level lock (FOR UPDATE)
            const [account] = await tx
                .select()
                .from(userCredits)
                .where(eq(userCredits.userId, userId))
                .limit(1)
                .for('update'); // ✅ Lock the row to prevent concurrent modifications

            if (!account) {
                // Create account if it doesn't exist
                await this.getOrCreateUserCredits(userId);
                // Re-run in a new transaction
                return this.deductCredits({ userId, amount, description, metadata, idempotencyKey });
            }

            if (idempotencyKey) {
                const [existingTx] = await tx
                    .select()
                    .from(creditTransactions)
                    .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
                    .limit(1);
                if (existingTx) {
                    const breakdown = this.extractBreakdown(existingTx.metadata) ?? {
                        subscription: 0,
                        bonus: 0,
                        purchased: Math.abs(existingTx.amount),
                    };
                    return { account, transaction: existingTx, breakdown };
                }
            }

            // Check balance (now guaranteed to be accurate due to row lock)
            if (account.totalBalance < amount) {
                throw new Error(
                    `Insufficient credits. Required: ${amount}, Available: ${account.totalBalance}`
                )
            }

            // 按优先级扣除：订阅 > 赠送 > 充值
            let remaining = amount
            const newBalances = {
                subscriptionCredits: account.subscriptionCredits,
                bonusCredits: account.bonusCredits,
                purchasedCredits: account.purchasedCredits,
            }

            // 1. 先扣订阅积分
            if (newBalances.subscriptionCredits > 0 && remaining > 0) {
                const deduct = Math.min(newBalances.subscriptionCredits, remaining)
                newBalances.subscriptionCredits -= deduct
                remaining -= deduct
            }

            // 2. 再扣赠送积分
            if (newBalances.bonusCredits > 0 && remaining > 0) {
                const deduct = Math.min(newBalances.bonusCredits, remaining)
                newBalances.bonusCredits -= deduct
                remaining -= deduct
            }

            // 3. 最后扣充值积分
            if (newBalances.purchasedCredits > 0 && remaining > 0) {
                const deduct = Math.min(newBalances.purchasedCredits, remaining)
                newBalances.purchasedCredits -= deduct
                remaining -= deduct
            }

            const breakdown = {
                subscription: account.subscriptionCredits - newBalances.subscriptionCredits,
                bonus: account.bonusCredits - newBalances.bonusCredits,
                purchased: account.purchasedCredits - newBalances.purchasedCredits,
            }

            const newTotalBalance = newBalances.subscriptionCredits + newBalances.bonusCredits + newBalances.purchasedCredits
            const newTotalSpent = account.totalSpent + amount

            // 更新账户 (within transaction)
            const [updatedAccount] = await tx
                .update(userCredits)
                .set({
                    subscriptionCredits: newBalances.subscriptionCredits,
                    bonusCredits: newBalances.bonusCredits,
                    purchasedCredits: newBalances.purchasedCredits,
                    totalBalance: newTotalBalance,
                    totalSpent: newTotalSpent,
                    updatedAt: new Date(),
                })
                .where(eq(userCredits.userId, userId))
                .returning()

            // 创建交易记录 (within transaction)
            const transactionRecord: NewCreditTransaction = {
                id: nanoid(),
                userId,
                type: "usage",
                amount: -amount, // 负数表示扣除
                balanceAfter: newTotalBalance,
                source: "usage",
                description,
                metadata: { ...(metadata ?? {}), breakdown },
                idempotencyKey,
            }

            const [createdTransaction] = await tx.insert(creditTransactions).values(transactionRecord).returning()

            console.log("[CreditService] Credits deducted:", {
                userId,
                amount,
                newBalance: newTotalBalance,
            })

            return { account: updatedAccount, transaction: createdTransaction, breakdown }
        }); // ✅ End of transaction
    }

    static async deductPurchasedCredits({
        userId,
        amount,
        description,
        metadata,
        idempotencyKey,
    }: {
        userId: string
        amount: number
        description?: string
        metadata?: Record<string, unknown>
        idempotencyKey?: string
    }): Promise<{ account: UserCredit; transaction: CreditTransaction; breakdown: { subscription: 0; bonus: 0; purchased: number } }> {
        return await db.transaction(async (tx) => {
            await this.getOrCreateUserCredits(userId, tx);

            const [account] = await tx
                .select()
                .from(userCredits)
                .where(eq(userCredits.userId, userId))
                .limit(1)
                .for("update");

            if (!account) {
                throw new Error("Credit account not found after creation");
            }

            if (idempotencyKey) {
                const [existingTx] = await tx
                    .select()
                    .from(creditTransactions)
                    .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
                    .limit(1);
                if (existingTx) {
                    const breakdown = this.extractBreakdown(existingTx.metadata) ?? {
                        subscription: 0,
                        bonus: 0,
                        purchased: Math.abs(existingTx.amount),
                    };
                    return {
                        account,
                        transaction: existingTx,
                        breakdown: {
                            subscription: 0,
                            bonus: 0,
                            purchased: breakdown.purchased,
                        },
                    };
                }
            }

            const effectivePurchasedCredits = Math.min(
                account.purchasedCredits,
                account.totalBalance,
            );

            if (effectivePurchasedCredits < amount) {
                throw new Error(
                    `Insufficient purchased credits. Required: ${amount}, Available: ${effectivePurchasedCredits}`
                );
            }

            const newPurchasedCredits = account.purchasedCredits - amount;
            const newTotalBalance = account.totalBalance - amount;
            const newTotalSpent = account.totalSpent + amount;
            const breakdown = {
                subscription: 0 as const,
                bonus: 0 as const,
                purchased: amount,
            };

            const [updatedAccount] = await tx
                .update(userCredits)
                .set({
                    purchasedCredits: newPurchasedCredits,
                    totalBalance: newTotalBalance,
                    totalSpent: newTotalSpent,
                    updatedAt: new Date(),
                })
                .where(eq(userCredits.userId, userId))
                .returning();

            const transactionRecord: NewCreditTransaction = {
                id: nanoid(),
                userId,
                type: "usage",
                amount: -amount,
                balanceAfter: newTotalBalance,
                source: "usage",
                description,
                metadata: { ...(metadata ?? {}), breakdown },
                idempotencyKey,
            };

            const [createdTransaction] = await tx
                .insert(creditTransactions)
                .values(transactionRecord)
                .returning();

            console.log("[CreditService] Purchased credits deducted:", {
                userId,
                amount,
                newBalance: newTotalBalance,
            });

            return { account: updatedAccount, transaction: createdTransaction, breakdown };
        });
    }

    /**
     * 退还积分（任务失败时退回预扣积分）
     * 退回到 purchasedCredits 桶
     */
    static async refundCredits({
        userId,
        amount,
        description,
        metadata,
        idempotencyKey,
    }: {
        userId: string
        amount: number
        description?: string
        metadata?: Record<string, unknown>
        idempotencyKey?: string
    }): Promise<{ account: UserCredit; transaction: CreditTransaction }> {
        return await db.transaction(async (tx) => {
            const [account] = await tx
                .select()
                .from(userCredits)
                .where(eq(userCredits.userId, userId))
                .limit(1)
                .for('update');

            if (!account) {
                await this.getOrCreateUserCredits(userId);
                return this.refundCredits({ userId, amount, description, metadata, idempotencyKey });
            }

            if (idempotencyKey) {
                const [existingTx] = await tx
                    .select()
                    .from(creditTransactions)
                    .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
                    .limit(1);
                if (existingTx) {
                    return { account, transaction: existingTx };
                }
            }

            const breakdown = this.extractBreakdown(metadata) ?? {
                subscription: 0,
                bonus: 0,
                purchased: amount,
            };
            const breakdownTotal = breakdown.subscription + breakdown.bonus + breakdown.purchased;
            const normalizedBreakdown = breakdownTotal === amount
                ? breakdown
                : { subscription: 0, bonus: 0, purchased: amount };

            const newTotalBalance = account.totalBalance + amount;

            const [updatedAccount] = await tx
                .update(userCredits)
                .set({
                    subscriptionCredits: sql`${userCredits.subscriptionCredits} + ${normalizedBreakdown.subscription}`,
                    bonusCredits: sql`${userCredits.bonusCredits} + ${normalizedBreakdown.bonus}`,
                    purchasedCredits: sql`${userCredits.purchasedCredits} + ${normalizedBreakdown.purchased}`,
                    totalBalance: sql`${userCredits.totalBalance} + ${amount}`,
                    totalSpent: sql`${userCredits.totalSpent} - ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(userCredits.userId, userId))
                .returning();

            const transactionRecord: NewCreditTransaction = {
                id: nanoid(),
                userId,
                type: "refund",
                amount,
                balanceAfter: newTotalBalance,
                source: "usage",
                description: description ?? "TASK_FAILED_REFUNDED",
                metadata: { ...(metadata ?? {}), breakdown: normalizedBreakdown },
                idempotencyKey,
            };

            const [createdTransaction] = await tx
                .insert(creditTransactions)
                .values(transactionRecord)
                .returning();

            console.log("[CreditService] Credits refunded:", {
                userId,
                amount,
                newBalance: newTotalBalance,
            });

            return { account: updatedAccount, transaction: createdTransaction };
        });
    }

    /**
     * 获取用户积分余额
     */
    static async getUserBalance(userId: string): Promise<number> {
        const account = await this.getOrCreateUserCredits(userId)
        return account.totalBalance
    }

    static async getPurchasedCreditsBalance(userId: string): Promise<number> {
        const account = await this.getOrCreateUserCredits(userId)
        return Math.max(0, Math.min(account.purchasedCredits, account.totalBalance))
    }

    static async getUserCreditAccount(userId: string): Promise<UserCredit | null> {
        const [account] = await db
            .select()
            .from(userCredits)
            .where(eq(userCredits.userId, userId))
            .limit(1)

        return account ?? null
    }

    /**
     * 获取用户积分交易历史
     */
    static async getUserTransactions(
        userId: string,
        limit = 20,
        offset = 0
    ): Promise<CreditTransaction[]> {
        return await db
            .select()
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, userId))
            .orderBy(desc(creditTransactions.createdAt))
            .limit(limit)
            .offset(offset)
    }

    /**
     * 清除过期的订阅积分
     */
    static async expireSubscriptionCredits(userId: string, dbClient?: DbClient): Promise<void> {
        const client = dbClient || db
        const account = await this.getOrCreateUserCredits(userId, client)

        if (account.subscriptionCredits === 0) {
            return // 没有订阅积分需要清除
        }

        const expiredAmount = account.subscriptionCredits

        // 更新账户
        await client
            .update(userCredits)
            .set({
                subscriptionCredits: 0,
                totalBalance: account.totalBalance - expiredAmount,
                updatedAt: new Date(),
            })
            .where(eq(userCredits.userId, userId))

        // 记录过期交易
        const transaction: NewCreditTransaction = {
            id: nanoid(),
            userId,
            type: "expire",
            amount: -expiredAmount,
            balanceAfter: account.totalBalance - expiredAmount,
            source: "subscription",
            description: "SUBSCRIPTION_CREDITS_EXPIRED",
        }

        await client.insert(creditTransactions).values(transaction)

        console.log("[CreditService] Subscription credits expired:", {
            userId,
            amount: expiredAmount,
        })
    }

    static async getTransactionByIdempotencyKey(idempotencyKey: string): Promise<CreditTransaction | null> {
        const [tx] = await db
            .select()
            .from(creditTransactions)
            .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
            .limit(1);
        return tx ?? null;
    }
}
