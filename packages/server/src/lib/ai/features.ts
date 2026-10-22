import { getEnv } from '@markless/shared/src/lib/config/env'

export type AiFeatureKind = 'text' | 'image_pair'

export type AiFeature = {
  version: string
  credits: number
  /** text：用户输入 prompt；image_pair：用户上传两张图片，prompt 由项目固定。 */
  kind: AiFeatureKind
  /** 仅 image_pair 使用，缺省时回退到内置默认 Prompt。 */
  prompt?: string
  /** 模型输入里承载 prompt 的字段名。 */
  promptField: string
  /** 模型输入里承载两张图片 URL 的字段名。 */
  imageFields: [string, string]
  /** 透传给模型的其它固定参数（仅允许 string、number、boolean）。 */
  params: Record<string, string | number | boolean>
}

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

function readFeatures(): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(getEnv('AI_FEATURES', '{}') || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch { return null }
}

export function listAiFeatures(): Array<{ key: string; credits: number; kind: AiFeatureKind }> {
  if (getEnv('REPLICATE_ENABLED') !== 'true') return []
  const features = readFeatures()
  if (!features) return []
  return Object.keys(features).filter(key => /^[a-z0-9_-]{1,40}$/.test(key))
    .map(key => ({ key, feature: getAiFeature(key) }))
    .filter((item): item is { key: string; feature: AiFeature } => item.feature !== null)
    .map(({ key, feature }) => ({ key, credits: feature.credits, kind: feature.kind }))
}

export function getAiFeature(key: string): AiFeature | null {
  if (getEnv('REPLICATE_ENABLED') !== 'true' || !getEnv('REPLICATE_API_TOKEN') || !getEnv('REPLICATE_WEBHOOK_SECRET')) return null
  const features = readFeatures()
  if (!features) return null
  const value = features[key]
  if (!value || typeof value !== 'object') return null
  const feature = value as Record<string, unknown>
  if (typeof feature.version !== 'string' || !/^[a-f0-9]{64}$/.test(feature.version)
    || !Number.isSafeInteger(feature.credits) || (feature.credits as number) < 1) return null

  const kind: AiFeatureKind = feature.kind === 'image_pair' ? 'image_pair' : 'text'
  const promptField = typeof feature.promptField === 'string' && FIELD_NAME.test(feature.promptField)
    ? feature.promptField : 'prompt'
  const rawFields = Array.isArray(feature.imageFields) ? feature.imageFields : ['image', 'image_2']
  if (rawFields.length !== 2 || !rawFields.every(field => typeof field === 'string' && FIELD_NAME.test(field))
    || rawFields[0] === rawFields[1]) return null
  const imageFields = [rawFields[0], rawFields[1]] as [string, string]

  const params: AiFeature['params'] = {}
  if (feature.params && typeof feature.params === 'object' && !Array.isArray(feature.params)) {
    for (const [name, param] of Object.entries(feature.params as Record<string, unknown>)) {
      if (!FIELD_NAME.test(name) || name === promptField || imageFields.includes(name)) continue
      if (typeof param === 'string' || typeof param === 'number' || typeof param === 'boolean') params[name] = param
    }
  }
  const prompt = typeof feature.prompt === 'string' && feature.prompt.trim() && feature.prompt.length <= 2000
    ? feature.prompt.trim() : undefined

  return { version: feature.version, credits: feature.credits as number, kind, prompt, promptField, imageFields, params }
}
