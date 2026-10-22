import { schedules } from '@trigger.dev/sdk/v3'
import { deleteFromR2, listR2Objects } from '@markless/server/src/lib/storage/r2-storage'
import { AI_UPLOAD_PREFIX, AI_UPLOAD_RETENTION_MS } from '@markless/server/src/lib/ai/uploads'

/** 删除超过保留期的匿名/临时上传图片，兑现「照片 24 小时内自动删除」的隐私承诺。 */
export const cleanupExpiredAiUploadsTask = schedules.task({
  id: 'cleanup-expired-ai-uploads',
  maxDuration: 300,
  cron: { pattern: '17 * * * *', timezone: 'UTC', environments: ['PRODUCTION'] },
  run: async () => {
    const cutoff = Date.now() - AI_UPLOAD_RETENTION_MS
    const objects = await listR2Objects(AI_UPLOAD_PREFIX, 2000)
    let deleted = 0
    let failed = 0
    for (const object of objects) {
      if (!object.lastModified || object.lastModified.getTime() > cutoff) continue
      try {
        await deleteFromR2(object.key)
        deleted++
      } catch {
        failed++
      }
    }
    if (failed > 0) throw new Error(`Failed to delete ${failed} expired AI uploads`)
    return { scanned: objects.length, deleted }
  },
})
