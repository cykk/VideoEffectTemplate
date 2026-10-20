import { and, eq, sql } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db/client";
import {
  redemptionCodes,
  redemptionRecords,
} from "@markless/server/src/lib/db/schema/redemption-codes";
import { CreditService } from "@markless/server/src/lib/credits/service";
import {
  APPSUMO_PROVIDER,
  APPSUMO_TIER_ID,
  getAppsumoCreditsAmount,
  getAppsumoMaxCodesPerUser,
  isAppsumoRedemptionEnabled,
  isValidRedemptionCodeFormat,
  normalizeRedemptionCode,
} from "@markless/shared/src/lib/redemption/config";
import type { ApiErrorCode } from "@markless/shared/src/types/api/video";

export class RedemptionError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RedemptionError";
  }
}

export interface RedemptionStatus {
  provider: typeof APPSUMO_PROVIDER;
  enabled: boolean;
  codesRedeemed: number;
  maxCodes: number;
  totalCreditsFromAppsumo: number;
  canRedeemMore: boolean;
  creditsPerCode: number;
}

export interface RedeemCodeResult {
  creditsGranted: number;
  totalBalance: number;
  appsumoCodesRedeemed: number;
  appsumoCodesRemaining: number;
}

export class RedemptionService {
  static async getAppsumoStatus(userId: string): Promise<RedemptionStatus> {
    const maxCodes = getAppsumoMaxCodesPerUser();
    const creditsPerCode = getAppsumoCreditsAmount();

    const [aggregate] = await db
      .select({
        codesRedeemed: sql<number>`count(*)::int`,
        totalCredits: sql<number>`coalesce(sum(${redemptionRecords.creditsGranted}), 0)::int`,
      })
      .from(redemptionRecords)
      .where(
        and(
          eq(redemptionRecords.userId, userId),
          eq(redemptionRecords.provider, APPSUMO_PROVIDER)
        )
      );

    const codesRedeemed = aggregate?.codesRedeemed ?? 0;
    const totalCreditsFromAppsumo = aggregate?.totalCredits ?? 0;

    return {
      provider: APPSUMO_PROVIDER,
      enabled: isAppsumoRedemptionEnabled(),
      codesRedeemed,
      maxCodes,
      totalCreditsFromAppsumo,
      canRedeemMore: codesRedeemed < maxCodes,
      creditsPerCode,
    };
  }

  static async redeemAppsumoCode(userId: string, rawCode: string): Promise<RedeemCodeResult> {
    if (!isAppsumoRedemptionEnabled()) {
      throw new RedemptionError("FORBIDDEN", "AppSumo redemption is currently unavailable");
    }

    const code = normalizeRedemptionCode(rawCode);

    if (!code || !isValidRedemptionCodeFormat(code)) {
      throw new RedemptionError("REDEMPTION_INVALID_CODE", "This redemption code is invalid");
    }

    const maxCodes = getAppsumoMaxCodesPerUser();

    return db.transaction(async (tx) => {
      const [existingCountRow] = await tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(redemptionRecords)
        .where(
          and(
            eq(redemptionRecords.userId, userId),
            eq(redemptionRecords.provider, APPSUMO_PROVIDER)
          )
        );

      const existingCount = existingCountRow?.count ?? 0;

      const [codeRow] = await tx
        .select()
        .from(redemptionCodes)
        .where(eq(redemptionCodes.code, code))
        .limit(1)
        .for("update");

      if (!codeRow) {
        throw new RedemptionError("REDEMPTION_INVALID_CODE", "This redemption code is invalid");
      }

      if (codeRow.status === "revoked") {
        throw new RedemptionError(
          "REDEMPTION_CODE_REVOKED",
          "This redemption code is no longer valid"
        );
      }

      if (codeRow.status === "redeemed") {
        if (codeRow.redeemedBy === userId) {
          return this.buildRedeemResult(userId, codeRow.creditsAmount, existingCount, maxCodes, tx);
        }

        throw new RedemptionError(
          "REDEMPTION_ALREADY_REDEEMED",
          "This redemption code has already been used"
        );
      }

      if (existingCount >= maxCodes) {
        throw new RedemptionError(
          "REDEMPTION_STACK_LIMIT_REACHED",
          `You can redeem up to ${maxCodes} AppSumo codes on one account`
        );
      }

      const { transaction, account } = await CreditService.grantCredits({
        userId,
        amount: codeRow.creditsAmount,
        source: "one_time",
        type: "purchase",
        description: "AppSumo redemption",
        metadata: {
          provider: APPSUMO_PROVIDER,
          code,
          batchId: codeRow.batchId,
          tierId: codeRow.tierId,
        },
        idempotencyKey: `appsumo:${code}`,
        tx,
      });

      const now = new Date();

      const [updatedCode] = await tx
        .update(redemptionCodes)
        .set({
          status: "redeemed",
          redeemedBy: userId,
          redeemedAt: now,
          updatedAt: now,
        })
        .where(eq(redemptionCodes.id, codeRow.id))
        .returning();

      if (!updatedCode || updatedCode.status !== "redeemed") {
        throw new RedemptionError("INTERNAL_ERROR", "Failed to redeem this code");
      }

      const [existingRecord] = await tx
        .select({ id: redemptionRecords.id })
        .from(redemptionRecords)
        .where(eq(redemptionRecords.codeId, codeRow.id))
        .limit(1);

      if (!existingRecord) {
        await tx.insert(redemptionRecords).values({
          codeId: codeRow.id,
          userId,
          provider: APPSUMO_PROVIDER,
          tierId: codeRow.tierId || APPSUMO_TIER_ID,
          creditsGranted: codeRow.creditsAmount,
          creditTransactionId: transaction.id,
        });
      }

      const codesRedeemed = existingCount + (existingRecord ? 0 : 1);

      return {
        creditsGranted: codeRow.creditsAmount,
        totalBalance: account.totalBalance,
        appsumoCodesRedeemed: codesRedeemed,
        appsumoCodesRemaining: Math.max(0, maxCodes - codesRedeemed),
      };
    });
  }

  private static async buildRedeemResult(
    userId: string,
    creditsAmount: number,
    existingCount: number,
    maxCodes: number,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ): Promise<RedeemCodeResult> {
    const account = await CreditService.getOrCreateUserCredits(userId, tx);

    return {
      creditsGranted: creditsAmount,
      totalBalance: account.totalBalance,
      appsumoCodesRedeemed: existingCount,
      appsumoCodesRemaining: Math.max(0, maxCodes - existingCount),
    };
  }
}
