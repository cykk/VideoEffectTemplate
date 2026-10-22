/** RainDance 功能的固定配置：Prompt 由项目维护，用户不需要输入任何文字。 */
export const RAINDANCE_FEATURE_KEY = 'raindance'

/**
 * 默认 Prompt。可在 AI_FEATURES 中为 raindance 功能配置 `prompt` 覆盖，
 * 这样调优 Prompt 不需要重新部署代码。
 */
export const RAINDANCE_DEFAULT_PROMPT = [
  'Two people from the two reference photos dance together outdoors in heavy rain.',
  'Keep each person\'s face, hairstyle, skin tone and outfit faithful to their reference photo.',
  'Natural, rhythmic full-body dance movement, playful and joyful, in sync with each other.',
  'Visible raindrops, splashing puddles, wet hair and clothes, soft cinematic evening light,',
  'shallow depth of field, handheld smartphone look, vertical 9:16 framing, TikTok rain dance trend.',
].join(' ')
