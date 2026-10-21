import { getEnv } from '@markless/shared/src/lib/config/env'

export type AiFeature = { version: string; credits: number }

export function listAiFeatures(): Array<{ key: string; credits: number }> {
  if (getEnv('REPLICATE_ENABLED') !== 'true') return []
  let features: Record<string, unknown>
  try { features = JSON.parse(getEnv('AI_FEATURES', '{}') || '{}') as Record<string, unknown> }
  catch { return [] }
  return Object.keys(features).filter(key => /^[a-z0-9_-]{1,40}$/.test(key))
    .map(key => ({ key, feature: getAiFeature(key) }))
    .filter((item): item is { key: string; feature: AiFeature } => item.feature !== null)
    .map(({ key, feature }) => ({ key, credits: feature.credits }))
}

export function getAiFeature(key: string): AiFeature | null {
  if (getEnv('REPLICATE_ENABLED') !== 'true' || !getEnv('REPLICATE_API_TOKEN') || !getEnv('REPLICATE_WEBHOOK_SECRET')) return null
  let features: Record<string, unknown>
  try { features = JSON.parse(getEnv('AI_FEATURES', '{}') || '{}') as Record<string, unknown> }
  catch { return null }
  const value = features[key]
  if (!value || typeof value !== 'object') return null
  const feature = value as Record<string, unknown>
  if (typeof feature.version !== 'string' || !/^[a-f0-9]{64}$/.test(feature.version)
    || !Number.isSafeInteger(feature.credits) || (feature.credits as number) < 1) return null
  return { version: feature.version, credits: feature.credits as number }
}
