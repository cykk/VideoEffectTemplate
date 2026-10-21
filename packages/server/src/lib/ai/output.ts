import { uploadToR2 } from '@markless/server/src/lib/storage/r2-storage'

const MAX_BYTES = 20 * 1024 * 1024
const extensions: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
}

export async function persistAiOutput(userId: string, jobId: string, output: unknown) {
  const first = Array.isArray(output) ? output[0] : output
  if (typeof first !== 'string') return { kind: 'json', value: output }
  let url: URL
  try { url = new URL(first) }
  catch { return { kind: 'text', value: first } }
  if (url.protocol !== 'https:' || !/(^|\.)replicate\.delivery$/.test(url.hostname))
    throw new Error('Untrusted Replicate output URL')
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  const contentType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() || ''
  if (!response.ok || !extensions[contentType] || Number(response.headers.get('content-length') || 0) > MAX_BYTES)
    throw new Error('Unsupported Replicate output')
  const chunks: Uint8Array[] = []
  let size = 0
  if (!response.body) throw new Error('Missing Replicate output')
  const reader = response.body.getReader()
  while (true) {
    const { done, value: chunk } = await reader.read()
    if (done) break
    size += chunk.length
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new Error('Replicate output exceeds size limit')
    }
    chunks.push(chunk)
  }
  const key = `private/ai/${userId}/${jobId}/result.${extensions[contentType]}`
  await uploadToR2(Buffer.concat(chunks), key, contentType)
  return { kind: 'asset', key, contentType }
}
