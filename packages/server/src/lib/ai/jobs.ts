import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, notInArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@markless/server/src/lib/db/client'
import { aiJobs } from '@markless/server/src/lib/db/schema/ai-jobs'
import { creditTransactions, userCredits } from '@markless/server/src/lib/db/schema/credits'
import { userSubscriptions } from '@markless/server/src/lib/db/schema/subscriptions'
import { CreditService } from '@markless/server/src/lib/credits/service'
import { getEnv } from '@markless/shared/src/lib/config/env'
import { buildWebhookUrl } from '@markless/shared/src/lib/config/urls'
import { requestReplicatePrediction, type ReplicateRequestError } from '@markless/server/src/lib/replicate/request'
import { getReplicatePrediction } from '@markless/server/src/lib/replicate/request'
import { getPresignedUrl, headR2Object } from '@markless/server/src/lib/storage/r2-storage'
import { getAiFeature } from './features'
import { persistAiOutput } from './output'
import { RAINDANCE_DEFAULT_PROMPT } from './raindance'
import { resolveAiUploadKey } from './uploads'

type Prediction = { id: string; status: string; output?: unknown; error?: string | null }
/** prompt 用于文字类任务；imageKeys 为已校验的 R2 对象键，仅用于双图类任务。 */
type ReserveInput = { prompt?: string; imageKeys?: string[] }
/** 提交入口接收的是用户可见的上传令牌，而不是对象键。 */
export type SubmitAiJobInput = { prompt?: string; images?: unknown }
const IMAGE_URL_TTL_SECONDS = 6 * 3600
const terminal = ['succeeded', 'failed', 'canceled']

export function aiWebhookToken(jobId: string): string {
  const secret = getEnv('REPLICATE_WEBHOOK_SECRET')
  if (!secret) throw new Error('Replicate webhook secret is not configured')
  return createHmac('sha256', secret).update(`ai-job:${jobId}`).digest('hex')
}

export function verifyAiWebhookToken(jobId: string, token: string | null): boolean {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false
  try { return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(aiWebhookToken(jobId), 'hex')) }
  catch { return false }
}

export async function getAiJobs(userId: string) {
  return db.select().from(aiJobs).where(eq(aiJobs.userId, userId)).orderBy(desc(aiJobs.createdAt)).limit(50)
}

export async function getAiJob(userId: string, id: string) {
  const [job] = await db.select().from(aiJobs).where(and(eq(aiJobs.id, id), eq(aiJobs.userId, userId)))
  return job || null
}

export async function getAiJobByRequestKey(userId: string, requestKey: string) {
  const [job] = await db.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.requestKey, requestKey)))
  return job || null
}

export async function reserveAiJob(userId: string, requestKey: string, featureKey: string, input: ReserveInput) {
  const feature = getAiFeature(featureKey)
  if (!feature || !/^[a-z0-9_-]{1,40}$/.test(featureKey)) throw new Error('app.ai.jobs.error.unavailable')
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestKey)) throw new Error('app.ai.jobs.error.invalid')
  let storedInput: Record<string, unknown>
  if (feature.kind === 'image_pair') {
    const keys = input.imageKeys
    if (!Array.isArray(keys) || keys.length !== 2 || new Set(keys).size !== 2
      || !keys.every(key => typeof key === 'string' && key.startsWith('private/ai-uploads/')))
      throw new Error('app.ai.jobs.error.invalid')
    storedInput = { prompt: feature.prompt || RAINDANCE_DEFAULT_PROMPT, imageKeys: keys }
  } else {
    if (!input.prompt?.trim() || input.prompt.length > 2000) throw new Error('app.ai.jobs.error.invalid')
    storedInput = { prompt: input.prompt.trim() }
  }
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`)
    const [existing] = await tx.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.requestKey, requestKey)))
    if (existing) return { job: existing, created: false }
    await CreditService.getOrCreateUserCredits(userId, tx)
    const [account] = await tx.select().from(userCredits).where(eq(userCredits.userId, userId)).for('update')
    if (!account || account.totalBalance < feature.credits) throw new Error('app.ai.jobs.error.credits')
    let remaining = feature.credits
    const subscription = Math.min(account.subscriptionCredits, remaining); remaining -= subscription
    const bonus = Math.min(account.bonusCredits, remaining); remaining -= bonus
    const purchased = Math.min(account.purchasedCredits, remaining); remaining -= purchased
    if (remaining !== 0) throw new Error('app.ai.jobs.error.credits')
    const id = nanoid()
    const [job] = await tx.insert(aiJobs).values({ id, userId, requestKey, featureKey,
      modelVersion: feature.version, credits: feature.credits, input: storedInput,
      creditBreakdown: { subscription, bonus, purchased } }).returning()
    await tx.update(userCredits).set({ subscriptionCredits: account.subscriptionCredits - subscription,
      bonusCredits: account.bonusCredits - bonus, purchasedCredits: account.purchasedCredits - purchased,
      totalBalance: account.totalBalance - feature.credits, totalSpent: account.totalSpent + feature.credits,
      updatedAt: new Date() }).where(eq(userCredits.userId, userId))
    await tx.insert(creditTransactions).values({ id: nanoid(), userId, type: 'usage', amount: -feature.credits,
      source: 'usage', balanceAfter: account.totalBalance - feature.credits,
      idempotencyKey: `ai:reserve:${id}`, metadata: { jobId: id, featureKey, breakdown: job.creditBreakdown } })
    return { job, created: true }
  })
}

export async function releaseAiJob(id: string, reason: string,
  review?: { adminId: string; evidence: string }) {
  return db.transaction(async tx => {
    const [candidate] = await tx.select().from(aiJobs).where(eq(aiJobs.id, id))
    if (!candidate) return null
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.userId}))`)
    const [job] = await tx.select().from(aiJobs).where(eq(aiJobs.id, id)).for('update')
    if (!job) return null
    if (terminal.includes(job.status)) {
      if (review) throw new Error('Job is already settled')
      return job
    }
    if (review && (job.predictionId || !['reserved', 'submitting', 'unknown'].includes(job.status)
      || job.createdAt > new Date(Date.now() - 10 * 60000))) {
      throw new Error('Job is not eligible for manual release')
    }
    await CreditService.getOrCreateUserCredits(job.userId, tx)
    const [account] = await tx.select().from(userCredits).where(eq(userCredits.userId, job.userId)).for('update')
    const activeSubscriptions = await tx.select().from(userSubscriptions).where(and(eq(userSubscriptions.userId, job.userId),
      eq(userSubscriptions.status, 'active'), gt(userSubscriptions.currentPeriodEnd, new Date())))
    const latestGrant = activeSubscriptions.reduce<Date | null>((latest, subscription) =>
      subscription.lastCreditGrantAt && (!latest || subscription.lastCreditGrantAt > latest)
        ? subscription.lastCreditGrantAt : latest, null)
    const sameGrantPeriod = latestGrant !== null && latestGrant <= job.createdAt &&
      activeSubscriptions.some(subscription => subscription.currentPeriodStart <= job.createdAt)
    const restoredSubscription = sameGrantPeriod ? job.creditBreakdown.subscription : 0
    const restored = restoredSubscription + job.creditBreakdown.bonus + job.creditBreakdown.purchased
    const [updated] = await tx.update(aiJobs).set({ status: 'failed', errorCode: reason,
      completedAt: new Date(), updatedAt: new Date() }).where(eq(aiJobs.id, id)).returning()
    if (restored > 0) {
      const balance = account.totalBalance + restored
      await tx.update(userCredits).set({ subscriptionCredits: account.subscriptionCredits + restoredSubscription,
        bonusCredits: account.bonusCredits + job.creditBreakdown.bonus,
        purchasedCredits: account.purchasedCredits + job.creditBreakdown.purchased,
        totalBalance: balance, totalSpent: Math.max(0, account.totalSpent - restored), updatedAt: new Date() })
        .where(eq(userCredits.userId, job.userId))
      await tx.insert(creditTransactions).values({ id: nanoid(), userId: job.userId, type: 'adjustment',
        amount: restored, source: 'usage', balanceAfter: balance, idempotencyKey: `ai:release:${id}`,
        metadata: { jobId: id, reason, review, expiredSubscriptionCredits: job.creditBreakdown.subscription - restoredSubscription } })
    } else if (review) {
      await tx.insert(creditTransactions).values({ id: nanoid(), userId: job.userId,
        type: 'adjustment', amount: 0, source: 'usage', balanceAfter: account.totalBalance,
        idempotencyKey: `ai:release:${id}`,
        metadata: { jobId: id, reason, review, expiredSubscriptionCredits: job.creditBreakdown.subscription } })
    }
    return updated
  })
}

/** 把已落库的任务输入转换成模型输入；双图任务需要为私有对象生成临时可读链接。 */
async function buildModelInput(job: typeof aiJobs.$inferSelect): Promise<Record<string, unknown>> {
  const feature = getAiFeature(job.featureKey)
  const imageKeys = (job.input as { imageKeys?: unknown }).imageKeys
  if (feature?.kind !== 'image_pair' || !Array.isArray(imageKeys) || imageKeys.length !== 2) return job.input
  const [first, second] = await Promise.all(imageKeys.map(key => getPresignedUrl(String(key), IMAGE_URL_TTL_SECONDS)))
  return { ...feature.params, [feature.promptField]: (job.input as { prompt?: string }).prompt,
    [feature.imageFields[0]]: first, [feature.imageFields[1]]: second }
}

export async function submitAiJob(userId: string, requestKey: string, featureKey: string, input: string | SubmitAiJobInput) {
  const submitted: SubmitAiJobInput = typeof input === 'string' ? { prompt: input } : input
  const feature = getAiFeature(featureKey)
  let imageKeys: string[] | undefined
  if (feature?.kind === 'image_pair') {
    const existing = await getAiJobByRequestKey(userId, requestKey)
    if (existing) return existing
    const tokens = Array.isArray(submitted.images) ? submitted.images : []
    const keys = tokens.map(resolveAiUploadKey)
    if (tokens.length !== 2 || keys.some(key => !key) || new Set(keys).size !== 2) throw new Error('app.ai.jobs.error.invalid')
    imageKeys = keys as string[]
    // 先确认两张图片都还在，避免扣了积分才发现图片已被清理。
    try { await Promise.all(imageKeys.map(key => headR2Object(key))) }
    catch { throw new Error('app.ai.jobs.error.invalid') }
  }
  const { job, created } = await reserveAiJob(userId, requestKey, featureKey, { prompt: submitted.prompt, imageKeys })
  if (!created) return job
  let webhook: string
  try { webhook = buildWebhookUrl(`/api/webhooks/replicate/jobs/${job.id}?token=${aiWebhookToken(job.id)}`) }
  catch { await releaseAiJob(job.id, 'webhook_unavailable'); throw new Error('app.ai.jobs.error.unavailable') }
  let modelInput: Record<string, unknown>
  try { modelInput = await buildModelInput(job) }
  catch { await releaseAiJob(job.id, 'input_unavailable'); throw new Error('app.ai.jobs.error.unavailable') }
  let prediction: Prediction
  await db.update(aiJobs).set({ status: 'submitting', updatedAt: new Date() })
    .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, 'reserved')))
  try {
    prediction = await requestReplicatePrediction<Prediction>({ version: job.modelVersion,
      input: modelInput, webhook, webhook_events_filter: ['completed'] })
    if (!prediction.id) throw new Error('Missing prediction ID')
  } catch (error) {
    const status = (error as ReplicateRequestError)?.status
    if (typeof status === 'number' && status >= 400 && status < 500) {
      await releaseAiJob(job.id, 'replicate_rejected')
      throw new Error('app.ai.jobs.error.unavailable')
    }
    await db.update(aiJobs).set({ status: 'unknown', errorCode: 'remote_submission_unknown', updatedAt: new Date() })
      .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, 'submitting')))
    throw new Error('app.ai.jobs.error.pending')
  }
  await db.update(aiJobs).set({ predictionId: prediction.id,
    status: terminal.includes(prediction.status) ? 'processing_output' : prediction.status,
    updatedAt: new Date() }).where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, 'submitting')))
  if (terminal.includes(prediction.status)) {
    try { await completeAiJob(job.id, prediction) }
    catch (error) {
      console.error('[AI jobs] Prediction output requires reconciliation', { jobId: job.id, error })
    }
  }
  return (await getAiJob(userId, job.id))!
}

export async function completeAiJob(id: string, prediction: Prediction) {
  const [candidate] = await db.select().from(aiJobs).where(eq(aiJobs.id, id))
  if (!candidate || terminal.includes(candidate.status) || !prediction.id || !terminal.includes(prediction.status)) return candidate || null
  if (candidate.predictionId && candidate.predictionId !== prediction.id) throw new Error('Prediction identity mismatch')
  if (prediction.status !== 'succeeded') return releaseAiJob(id, prediction.status)
  const output = await persistAiOutput(candidate.userId, id, prediction.output)
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${candidate.userId}))`)
    const [job] = await tx.select().from(aiJobs).where(eq(aiJobs.id, id)).for('update')
    if (!job || terminal.includes(job.status)) return job || null
    if (job.predictionId && job.predictionId !== prediction.id) throw new Error('Prediction identity mismatch')
    const [updated] = await tx.update(aiJobs).set({ predictionId: prediction.id, status: 'succeeded',
      output,
      completedAt: new Date(), updatedAt: new Date() }).where(eq(aiJobs.id, id)).returning()
    return updated
  })
}

/** Read-only reconciliation never creates a second prediction. */
export async function reconcileAiJobs(limit = 20) {
  if (!getEnv('REPLICATE_API_TOKEN')) return { disabled: true }
  const candidates = await db.select().from(aiJobs).where(and(isNotNull(aiJobs.predictionId),
    notInArray(aiJobs.status, terminal), lt(aiJobs.updatedAt, new Date(Date.now() - 2 * 60000))))
    .orderBy(aiJobs.updatedAt).limit(limit)
  let processed = 0, failed = 0
  for (const job of candidates) {
    try {
      const prediction = await getReplicatePrediction<Prediction>(job.predictionId!)
      if (prediction.id !== job.predictionId) throw new Error('Prediction identity mismatch')
      if (terminal.includes(prediction.status)) await completeAiJob(job.id, prediction)
      else await db.update(aiJobs).set({ status: prediction.status, updatedAt: new Date() }).where(eq(aiJobs.id, job.id))
      processed++
    } catch {
      failed++
      console.error('[AI jobs] Reconciliation requires attention', { jobId: job.id })
    }
  }
  const staleAt = new Date(Date.now() - 10 * 60000)
  const unresolved = await db.select({ id: aiJobs.id, status: aiJobs.status }).from(aiJobs).where(and(
    isNull(aiJobs.predictionId), inArray(aiJobs.status, ['reserved', 'submitting', 'unknown']),
    lt(aiJobs.updatedAt, staleAt))).limit(limit)
  for (const job of unresolved) {
    if (job.status !== 'unknown') await db.update(aiJobs).set({ status: 'unknown',
      errorCode: 'remote_submission_unverified', updatedAt: new Date() })
      .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, job.status), isNull(aiJobs.predictionId)))
  }
  if (unresolved.length) console.error('[AI jobs] Remote submissions need manual verification', { jobIds: unresolved.map(job => job.id) })
  return { processed, failed, unresolved: unresolved.length }
}

export async function getAiJobsNeedingReview(limit = 100) {
  return db.select({ id: aiJobs.id, userId: aiJobs.userId, status: aiJobs.status,
    predictionId: aiJobs.predictionId, errorCode: aiJobs.errorCode,
    createdAt: aiJobs.createdAt, updatedAt: aiJobs.updatedAt })
    .from(aiJobs).where(and(inArray(aiJobs.status, ['reserved', 'submitting', 'unknown']),
      lt(aiJobs.createdAt, new Date(Date.now() - 10 * 60000))))
    .orderBy(aiJobs.updatedAt).limit(limit)
}
