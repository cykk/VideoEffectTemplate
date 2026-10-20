/**
 * Cloudflare R2 Storage Client
 * Handles video file uploads and CDN URL generation
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createSizeLimitedStream } from './size-limit-stream';
import type { Readable } from 'stream';
import { buildR2PublicUrl, resolveR2AccountId } from '@markless/server/src/lib/storage/r2-core';
import { getEnv } from "@markless/shared/src/lib/config/env";
import { NonRetryableTaskError } from "@markless/shared/src/lib/tasks/errors";


// R2 credentials from environment
// 支持两种配置方式：
// 1. 使用 R2_ENDPOINT (推荐) - 完整的 endpoint URL，会自动提取 ACCOUNT_ID
// 2. 使用 R2_ACCOUNT_ID - 直接指定 account ID
const R2_ENDPOINT = getEnv("R2_ENDPOINT");
const R2_ACCOUNT_ID = resolveR2AccountId();
const R2_ACCESS_KEY_ID = getEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = getEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = getEnv("R2_BUCKET_NAME") || 'markless';
// 支持 R2_PUBLIC_DOMAIN
const R2_PUBLIC_DOMAIN = getEnv("R2_PUBLIC_DOMAIN");

// ⚠️ 启动时记录配置状态（用于调试）
console.log('[R2] Configuration loaded:', {
    endpoint: R2_ENDPOINT ? `${R2_ENDPOINT.substring(0, 40)}...` : 'NOT SET',
    accountId: R2_ACCOUNT_ID ? `${R2_ACCOUNT_ID.substring(0, 8)}...` : 'NOT SET',
    accessKeyId: R2_ACCESS_KEY_ID ? `${R2_ACCESS_KEY_ID.substring(0, 8)}...` : 'NOT SET',
    secretAccessKey: R2_SECRET_ACCESS_KEY ? 'SET (hidden)' : 'NOT SET',
    bucketName: R2_BUCKET_NAME,
    publicDomain: R2_PUBLIC_DOMAIN,
});

/**
 * Validate R2 configuration
 */
export function validateR2Config(): void {
    const missingVars: string[] = [];

    if (!R2_ACCOUNT_ID) missingVars.push('R2_ACCOUNT_ID or R2_ENDPOINT');
    if (!R2_ACCESS_KEY_ID) missingVars.push('R2_ACCESS_KEY_ID');
    if (!R2_SECRET_ACCESS_KEY) missingVars.push('R2_SECRET_ACCESS_KEY');

    if (missingVars.length > 0) {
        const errorMsg = `Missing R2 configuration: ${missingVars.join(', ')}. Check environment variables in the active runtime environment file.`;
        console.error(`[R2] ${errorMsg}`);
        console.error(`[R2] Current values:`, {
            R2_ENDPOINT: R2_ENDPOINT ? 'SET' : 'NOT SET',
            R2_ACCOUNT_ID: R2_ACCOUNT_ID ? 'SET' : 'NOT SET',
            R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
            R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
        });
        throw new Error(errorMsg);
    }

    console.log('[R2] ✅ Configuration validated successfully');
}

/**
 * Create R2 S3-compatible client
 * 🔥 修复内存泄漏：使用单例模式复用 S3Client 实例
 */
let cachedR2Client: S3Client | null = null;

function getR2Client(): S3Client {
    if (cachedR2Client) {
        return cachedR2Client;
    }

    validateR2Config();

    cachedR2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID!,
            secretAccessKey: R2_SECRET_ACCESS_KEY!,
        },
    });

    console.log('[R2] ✅ S3Client instance created (singleton)');
    return cachedR2Client;
}

/**
 * Generate unique storage key for media (video or image)
 */
function generateVideoKey(taskId: string, type: 'video' | 'image' | 'thumbnail'): string {
    const now = new Date();
    const timestamp = now.getTime();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    let extension = 'mp4';
    let folder = 'videos';

    if (type === 'image') {
        extension = 'webp';
        folder = 'images';
    } else if (type === 'thumbnail') {
        extension = 'webp';
        folder = 'thumbnails';
    }

    // Path structure: generations/{folder}/{year}/{month}/{taskId}-{timestamp}-{type}.{ext}
    return `generations/${folder}/${year}/${month}/${taskId}-${timestamp}-${type}.${extension}`;
}

/**
 * Sanitize URL for logging (remove sensitive query parameters)
 */
function sanitizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.search = ''; // Remove query parameters (may contain tokens)
        return parsed.toString();
    } catch {
        return '[invalid URL]';
    }
}

/**
 * Validate source URL to prevent SSRF attacks
 */
function validateSourceUrl(url: string): void {
    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch {
        throw new NonRetryableTaskError(`Invalid URL format: ${sanitizeUrl(url)}`);
    }

    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
        throw new NonRetryableTaskError(`Only HTTPS URLs are allowed, got: ${parsed.protocol}`);
    }

    // Whitelist allowed hosts (prevent SSRF)
    const allowedHosts = [
        'replicate.delivery',
        'replicate.com',
        'r2.cloudflarestorage.com',
        'storage.googleapis.com', // Google Cloud Storage (if used)
    ];

    const isAllowed = allowedHosts.some(host =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );

    if (!isAllowed) {
        throw new NonRetryableTaskError(
            `Source host not allowed: ${parsed.hostname}. Only trusted sources are permitted.`
        );
    }
}

/**
 * Download file with exponential backoff retry
 * Distinguishes between retriable and non-retriable errors
 */
async function downloadWithRetry(
    url: string,
    maxRetries: number = 3
): Promise<Response> {
    // ✅ Validate URL first (security check)
    validateSourceUrl(url);

    let lastError: Error | null = null;
    const sanitizedUrl = sanitizeUrl(url);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[R2] Download attempt ${attempt}/${maxRetries}: ${sanitizedUrl}`);
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000), // 30s timeout
            });

            if (response.ok) {
                console.log(`[R2] ✅ Download successful: ${sanitizedUrl}`);
                return response;
            }

            // ❌ Client errors (4xx) are NOT retriable
            if (response.status >= 400 && response.status < 500) {
                const errorMsg = `Source ${response.status === 404 ? 'not found' : 'access denied'}: ${response.status} ${response.statusText}`;
                console.error(`[R2] ❌ ${errorMsg} (non-retriable)`);

                // Mark client-side source issues as non-retryable.
                throw new NonRetryableTaskError(errorMsg);
            }

            // ⚠️ Server errors (5xx) are retriable
            if (response.status >= 500) {
                lastError = new Error(`Server error: ${response.status} ${response.statusText}`);

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    console.warn(`[R2] ⚠️ Server error, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }

            // Other HTTP errors
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);

        } catch (error) {
            // If already a non-retryable error, don't retry
            if (error instanceof NonRetryableTaskError) {
                throw error;
            }

            lastError = error as Error;

            // ⚠️ Network errors and timeouts are retriable
            const isNetworkError = error instanceof TypeError ||
                (error as Error).name === 'AbortError' ||
                (error as Error).message.includes('fetch failed');

            if (attempt < maxRetries && isNetworkError) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`[R2] ⚠️ Network error (${(error as Error).message}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Max retries exceeded or non-retriable error
            throw error;
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

/**
 * Upload media file to R2 from remote URL
 *
 * @param sourceUrl - Source media URL to download (Replicate, etc.)
 * @param taskId - Task ID for storage path
 * @param type - 'video', 'image', or 'thumbnail'
 * @returns Public CDN URL
 */
export async function uploadVideoToR2(
    sourceUrl: string,
    taskId: string,
    type: 'video' | 'image' | 'thumbnail' = 'video'
): Promise<string> {
    const sanitizedUrl = sanitizeUrl(sourceUrl);
    let response: Response | null = null;

    try {
        // 1. Download video from source with retry
        console.log(`[R2] Downloading ${type} from source: ${sanitizedUrl}`);
        response = await downloadWithRetry(sourceUrl, 3);

        // ✅ P0 FIX: Validate file size before downloading
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for videos
        const MAX_IMAGE_SIZE = 50 * 1024 * 1024;  // 50MB for images
        const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024; // 10MB for thumbnails

        const maxSize = type === 'video' ? MAX_VIDEO_SIZE
            : type === 'image' ? MAX_IMAGE_SIZE
                : MAX_THUMBNAIL_SIZE;

        // ❌ File too large - non-retriable error
        if (contentLength > maxSize) {
            const sizeMB = (contentLength / 1024 / 1024).toFixed(2);
            const limitMB = (maxSize / 1024 / 1024).toFixed(2);
            throw new NonRetryableTaskError(
                `${type} size ${sizeMB}MB exceeds limit ${limitMB}MB`
            );
        }

        // ⚠️ Missing content-length - warn but continue
        if (!contentLength || contentLength === 0) {
            console.warn(`[R2] ⚠️ Missing or invalid content-length header for ${type}, proceeding with caution`);
        } else {
            console.log(`[R2] ${type} size: ${(contentLength / 1024 / 1024).toFixed(2)}MB (within ${(maxSize / 1024 / 1024).toFixed(2)}MB limit)`);
        }

        // ✅ P0 FIX: Ensure correct Content-Type
        // Videos: always use 'video/mp4'
        // Images: use 'image/webp' or actual content type
        // Thumbnails: use 'image/jpeg' or actual content type
        const responseContentType = response.headers.get('content-type') || undefined;
        const contentType = type === 'video'
            ? 'video/mp4'  // ✅ 强制使用 video/mp4，确保浏览器可以播放
            : type === 'image'
                ? (responseContentType || 'image/webp') // ✅ 图片使用实际类型（回退 webp）
                : (responseContentType || 'image/jpeg'); // ✅ 缩略图使用实际类型或 jpeg

        const imageExtension = type === 'image'
            ? (contentType === 'image/png'
                ? 'png'
                : contentType === 'image/jpeg'
                    ? 'jpg'
                    : contentType === 'image/webp'
                        ? 'webp'
                        : 'png')
            : undefined;

        console.log(`[R2] Content-Type for ${type}: ${contentType}`);

        // 2. Upload to R2
        const key = generateVideoKey(taskId, type);
        const client = getR2Client();

        console.log(`[R2] Uploading ${type} to R2: ${key}`);

        // ✅ P1 FIX: Use streaming upload with proper resource cleanup
        // This prevents OOM (Out of Memory) errors for large video files

        // Check if we can use streaming (Node.js environment with response.body)
        if (response.body) {
            // Streaming upload (memory efficient)
            const sizeMB = contentLength ? (contentLength / 1024 / 1024).toFixed(2) : 'unknown';
            console.log(`[R2] Using streaming upload for ${type} (${sizeMB}MB)`);

            // ✅ P1 FIX: Apply size limit to stream to prevent memory bombs
            // Even if content-length header is missing or incorrect
            const sizeLimitedStream = createSizeLimitedStream(response.body, maxSize);

            let uploadId: string | undefined;
            // 🔥 为图片设置 Content-Disposition，解决跨域下载问题
            const contentDisposition = type === 'image'
                ? `attachment; filename="image-${taskId}.${imageExtension || 'png'}"`
                : undefined;

            const upload = new Upload({
                client,
                params: {
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: sizeLimitedStream,  // ✅ Use size-limited stream
                    ContentType: contentType,
                    ContentLength: contentLength || undefined,
                    ContentDisposition: contentDisposition, // 🔥 图片强制下载
                    CacheControl: 'public, max-age=31536000, immutable',
                    Metadata: {
                        taskId,
                        uploadedAt: new Date().toISOString(),
                        sourceUrl: sanitizedUrl,
                        fileSize: contentLength ? contentLength.toString() : 'unknown',
                    },
                },
                // Multipart upload settings for large files
                queueSize: 4,           // 4 parallel uploads
                partSize: 10 * 1024 * 1024,  // 10MB per part
                leavePartsOnError: false, // ✅ Auto-cleanup on error
            });

            // Track upload ID for manual cleanup if needed
            upload.on('httpUploadProgress', (progress) => {
                // Capture upload ID from first progress event
                if (progress.Key && !uploadId) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    uploadId = (progress as any).UploadId;
                }

                if (progress.loaded && progress.total) {
                    const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
                    console.log(`[R2] Upload progress: ${percent}% (${(progress.loaded / 1024 / 1024).toFixed(2)}MB / ${(progress.total / 1024 / 1024).toFixed(2)}MB)`);
                }
            });

            try {
                await upload.done();
                console.log(`[R2] ✅ Streaming upload completed for ${type}`);
            } catch (uploadErr) {
                const error = uploadErr as Error;
                console.error(`[R2] ❌ Upload failed:`, error.message);

                // ✅ P1 FIX: Cleanup orphaned multipart upload parts
                if (uploadId) {
                    try {
                        await client.send(
                            new AbortMultipartUploadCommand({
                                Bucket: R2_BUCKET_NAME,
                                Key: key,
                                UploadId: uploadId,
                            })
                        );
                        console.log(`[R2] ✅ Aborted multipart upload ${uploadId}`);
                    } catch (abortErr) {
                        console.error(`[R2] ⚠️ Failed to abort multipart upload:`, abortErr);
                    }
                }

                // Ensure stream is cancelled
                if (!sizeLimitedStream.locked) {
                    try {
                        await sizeLimitedStream.cancel();
                        console.log(`[R2] Stream cancelled after upload failure`);
                    } catch (cancelErr) {
                        console.error(`[R2] Failed to cancel stream:`, cancelErr);
                    }
                }

                // Convert size limit errors to a non-retryable task error.
                if (error.name === 'StreamSizeLimitExceeded') {
                    throw new NonRetryableTaskError(error.message);
                }

                throw uploadErr;
            }
        } else {
            // Fallback: Buffer upload (for environments without streams)
            console.log(`[R2] Using buffer upload for ${type} (no stream available)`);

            const blob = await response.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());

            // Verify buffer size
            if (buffer.length > maxSize) {
                throw new NonRetryableTaskError(
                    `Actual file size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds limit`
                );
            }

            // 🔥 为图片设置 Content-Disposition，解决跨域下载问题
            const contentDisposition = type === 'image'
                ? `attachment; filename="image-${taskId}.${imageExtension || 'png'}"`
                : undefined;

            await client.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                    ContentLength: buffer.length,
                    ContentDisposition: contentDisposition, // 🔥 图片强制下载
                    CacheControl: 'public, max-age=31536000, immutable',
                    Metadata: {
                        taskId,
                        uploadedAt: new Date().toISOString(),
                        sourceUrl: sanitizedUrl, // ✅ Use sanitized URL
                        fileSize: buffer.length.toString(),
                    },
                })
            );

            console.log(`[R2] ✅ Buffer upload completed for ${type}`);
        }

        // 3. Generate public URL
        let publicUrl: string;
        if (R2_PUBLIC_DOMAIN) {
            publicUrl = buildR2PublicUrl(R2_PUBLIC_DOMAIN, key);
        } else {
            publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
        }

        console.log(`[R2] ✅ ${type} uploaded successfully: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        // ✅ Ensure stream cleanup on any error
        if (response?.body && !response.body.locked) {
            try {
                await response.body.cancel();
                console.log(`[R2] Stream cleaned up after error`);
            } catch (cancelErr) {
                console.error(`[R2] Failed to cleanup stream:`, cancelErr);
            }
        }

        console.error(`[R2] ❌ Failed to upload ${type}:`, error);

        // Preserve non-retryable errors.
        if (error instanceof NonRetryableTaskError) {
            throw error; // Don't wrap, preserve non-retriable nature
        }

        // Wrap other errors in R2Error for context
        throw new R2Error(
            'UPLOAD_FAILED',
            `Failed to upload ${type} to R2: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { sourceUrl: sanitizedUrl, taskId, type }
        );
    }
}

/**
 * Check if a video exists in R2
 *
 * @param key - R2 object key
 * @returns true if exists, false otherwise
 */
export async function checkVideoExists(key: string): Promise<boolean> {
    try {
        const client = getR2Client();
        await client.send(
            new HeadObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
            })
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Upload video buffer directly to R2 (for local uploads)
 *
 * @param buffer - Video file buffer
 * @param taskId - Task ID
 * @param contentType - MIME type
 * @returns Public CDN URL
 */
export async function uploadBufferToR2(
    buffer: Buffer,
    taskId: string,
    contentType: string = 'video/mp4'
): Promise<string> {
    try {
        const key = generateVideoKey(taskId, 'video');
        const client = getR2Client();

        await client.send(
            new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable',
                Metadata: {
                    taskId,
                    uploadedAt: new Date().toISOString(),
                },
            })
        );

        let publicUrl: string;
        if (R2_PUBLIC_DOMAIN) {
            publicUrl = buildR2PublicUrl(R2_PUBLIC_DOMAIN, key);
        } else {
            publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
        }

        return publicUrl;
    } catch (error) {
        console.error('[R2] Failed to upload buffer:', error);
        throw new R2Error(
            'UPLOAD_FAILED',
            'Failed to upload video buffer to R2',
            { taskId }
        );
    }
}

/**
 * Upload media stream directly to R2 (memory efficient)
 *
 * @param stream - Readable stream
 * @param taskId - Task ID
 * @param contentType - MIME type
 * @param type - 'video', 'image', or 'thumbnail'
 * @returns Public CDN URL
 */
export async function uploadStreamToR2(
    stream: Readable | ReadableStream,
    taskId: string,
    contentType: string = 'video/mp4',
    type: 'video' | 'image' | 'thumbnail' = 'video'
): Promise<string> {
    try {
        const key = generateVideoKey(taskId, type);
        const client = getR2Client();

        console.log(`[R2] Starting streaming upload for ${type}: ${key}`);

        // 🔥 为图片设置 Content-Disposition，解决跨域下载问题
        const contentDisposition = type === 'image'
            ? `attachment; filename="image-${taskId}.webp"`
            : undefined;

        const upload = new Upload({
            client,
            params: {
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: stream,
                ContentType: contentType,
                ContentDisposition: contentDisposition, // 🔥 图片强制下载
                CacheControl: 'public, max-age=31536000, immutable',
                Metadata: {
                    taskId,
                    uploadedAt: new Date().toISOString(),
                    uploadType: 'stream',
                },
            },
            queueSize: 4,
            partSize: 10 * 1024 * 1024,
            leavePartsOnError: false,
        });

        await upload.done();

        let publicUrl: string;
        if (R2_PUBLIC_DOMAIN) {
            publicUrl = buildR2PublicUrl(R2_PUBLIC_DOMAIN, key);
        } else {
            publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
        }

        console.log(`[R2] ✅ Streaming upload completed: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('[R2] ❌ Failed to upload stream:', error);
        throw new R2Error(
            'UPLOAD_FAILED',
            `Failed to upload ${type} stream to R2`,
            { taskId }
        );
    }
}

/**
 * Extract R2 key from full URL
 */
function extractKeyFromUrl(url: string): string | null {
    try {
        // Handle full URLs
        if (url.startsWith('http')) {
            const parsed = new URL(url);
            return parsed.pathname.substring(1);
        }
        // If it's already a key, return as is
        return url;
    } catch {
        return null;
    }
}

/**
 * Delete a file from R2
 *
 * @param url - Full R2 URL or key
 * @returns true if deleted, false otherwise
 */
export async function deleteFromR2(url: string): Promise<boolean> {
    try {
        const key = extractKeyFromUrl(url) || url;
        const client = getR2Client();

        await client.send(
            new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
            })
        );

        console.log(`[R2] ✅ Deleted: ${key}`);
        return true;
    } catch (error) {
        console.error(`[R2] ❌ Failed to delete ${url}:`, error);
        return false;
    }
}

/**
 * Custom error class for R2 operations
 */
export class R2Error extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
        super(message);
        this.name = 'R2Error';
        this.code = code;
        this.details = details;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
        };
    }
}
