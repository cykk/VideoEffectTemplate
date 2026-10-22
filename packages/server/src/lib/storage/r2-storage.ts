import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { getEnv } from "@markless/shared/src/lib/config/env";
import {
    buildR2PublicUrl,
    normalizeR2Domain,
    resolveR2AccountId,
    resolveR2Endpoint,
} from "@markless/server/src/lib/storage/r2-core";

type R2ResolvedConfig = {
    endpoint: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicDomain: string;
    metadataSource?: string;
};

export class R2ConfigurationError extends Error {
    readonly missingKeys: string[];

    constructor(message: string, missingKeys: string[] = []) {
        super(message);
        this.name = "R2ConfigurationError";
        this.missingKeys = missingKeys;
    }
}

export class R2OperationError extends Error {
    readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "R2OperationError";
        this.cause = cause;
    }
}

let cachedClient: S3Client | null = null;
let cachedClientKey: string | null = null;

function buildAttachmentContentDisposition(filename: string): string {
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function resolveR2Config(): R2ResolvedConfig {
    const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");
    const bucketName = getEnv("R2_BUCKET_NAME");
    const endpoint = resolveR2Endpoint();

    const missingKeys: string[] = [];
    if (!accessKeyId) {
        missingKeys.push("R2_ACCESS_KEY_ID");
    }
    if (!secretAccessKey) {
        missingKeys.push("R2_SECRET_ACCESS_KEY");
    }
    if (!bucketName) {
        missingKeys.push("R2_BUCKET_NAME");
    }
    if (!endpoint) {
        missingKeys.push("R2_ENDPOINT_OR_R2_ACCOUNT_ID");
    }

    if (missingKeys.length > 0) {
        throw new R2ConfigurationError(
            `Missing required R2 configuration: ${missingKeys.join(", ")}`,
            missingKeys
        );
    }

    return {
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
        publicDomain: getEnv("R2_PUBLIC_DOMAIN") || "",
        metadataSource: getEnv("R2_METADATA_SOURCE"),
    };
}

function getR2Client(config: R2ResolvedConfig): S3Client {
    const clientKey = [
        config.endpoint,
        config.accessKeyId,
        config.secretAccessKey,
    ].join("|");

    if (cachedClient && cachedClientKey === clientKey) {
        return cachedClient;
    }

    cachedClient = new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
    });
    cachedClientKey = clientKey;

    return cachedClient;
}

export async function uploadToR2(
    file: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const metadata: Record<string, string> = {
            "uploaded-at": new Date().toISOString(),
        };
        if (config.metadataSource) {
            metadata.source = config.metadataSource;
        }

        const command = new PutObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            Body: file,
            ContentType: contentType,
            CacheControl: getR2CacheControl(key),
            Metadata: metadata,
        });

        await r2Client.send(command);

        if (isPublicR2Key(key) && config.publicDomain) {
            return buildR2PublicUrl(config.publicDomain, key);
        }

        return await getPresignedUrl(key, 604800);
    } catch (error) {
        console.error("R2 upload error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to upload file to R2", error);
    }
}

export async function getPresignedUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const command = new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await getSignedUrl(r2Client as any, command, { expiresIn });
    } catch (error) {
        console.error("R2 presigned URL error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to generate presigned URL", error);
    }
}

export async function getPresignedDownloadUrl(
    key: string,
    options: {
        filename?: string;
        contentType?: string;
        expiresIn?: number;
    } = {}
): Promise<string> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const command = new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            ...(options.filename
                ? { ResponseContentDisposition: buildAttachmentContentDisposition(options.filename) }
                : {}),
            ...(options.contentType
                ? { ResponseContentType: options.contentType }
                : {}),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await getSignedUrl(r2Client as any, command, {
            expiresIn: options.expiresIn ?? 900,
        });
    } catch (error) {
        console.error("R2 presigned download URL error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to generate presigned download URL", error);
    }
}

export async function getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 900
): Promise<string> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const command = new PutObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            ContentType: contentType,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await getSignedUrl(r2Client as any, command, { expiresIn });
    } catch (error) {
        console.error("R2 presigned upload URL error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to generate presigned upload URL", error);
    }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
    if (!body) {
        throw new Error("R2 object body is empty");
    }

    if (
        typeof body === "object" &&
        body !== null &&
        "transformToByteArray" in body &&
        typeof body.transformToByteArray === "function"
    ) {
        const bytes = await body.transformToByteArray();
        return Buffer.from(bytes);
    }

    if (body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    throw new Error("Unsupported R2 object body type");
}

export async function headR2Object(
    key: string
): Promise<{ contentLength: number; contentType: string | undefined }> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const response = await r2Client.send(
            new HeadObjectCommand({
                Bucket: config.bucketName,
                Key: key,
            })
        );

        return {
            contentLength: Number(response.ContentLength || 0),
            contentType: response.ContentType,
        };
    } catch (error) {
        console.error("R2 head object error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to read file metadata from R2", error);
    }
}

/**
 * Verifies that the configured R2 bucket and credentials can read the private
 * sentinel object used by the API readiness probe.
 */
export async function checkR2Readiness(signal?: AbortSignal): Promise<void> {
    const healthcheckKey = getEnv("R2_HEALTHCHECK_KEY");
    if (!healthcheckKey) {
        throw new R2ConfigurationError(
            "Missing required R2 health check configuration: R2_HEALTHCHECK_KEY",
            ["R2_HEALTHCHECK_KEY"]
        );
    }

    const config = resolveR2Config();
    const r2Client = getR2Client(config);

    await r2Client.send(
        new HeadObjectCommand({
            Bucket: config.bucketName,
            Key: healthcheckKey,
        }),
        { abortSignal: signal }
    );
}

export async function downloadFromR2(key: string): Promise<Buffer> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const response = await r2Client.send(
            new GetObjectCommand({
                Bucket: config.bucketName,
                Key: key,
            })
        );

        return await streamToBuffer(response.Body);
    } catch (error) {
        console.error("R2 download error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to download file from R2", error);
    }
}

export async function resolveR2ObjectUrl(key: string): Promise<string> {
    const publicDomain = getEnv("R2_PUBLIC_DOMAIN") || "";
    if (isPublicR2Key(key) && publicDomain) {
        return buildR2PublicUrl(publicDomain, key);
    }

    return getPresignedUrl(key, 604800);
}

export async function deleteFromR2(key: string): Promise<void> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const command = new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: key,
        });

        await r2Client.send(command);
    } catch (error) {
        console.error("R2 delete error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to delete file from R2", error);
    }
}

/**
 * 按前缀列出对象（最多 maxKeys 个），用于清理临时文件等运维任务。
 */
export async function listR2Objects(
    prefix: string,
    maxKeys: number = 1000
): Promise<Array<{ key: string; lastModified: Date | null }>> {
    try {
        const config = resolveR2Config();
        const r2Client = getR2Client(config);
        const objects: Array<{ key: string; lastModified: Date | null }> = [];
        let continuationToken: string | undefined;

        while (objects.length < maxKeys) {
            const response = await r2Client.send(
                new ListObjectsV2Command({
                    Bucket: config.bucketName,
                    Prefix: prefix,
                    MaxKeys: Math.min(1000, maxKeys - objects.length),
                    ContinuationToken: continuationToken,
                })
            );
            for (const item of response.Contents ?? []) {
                if (item.Key) {
                    objects.push({ key: item.Key, lastModified: item.LastModified ?? null });
                }
            }
            if (!response.IsTruncated || !response.NextContinuationToken) {
                break;
            }
            continuationToken = response.NextContinuationToken;
        }

        return objects;
    } catch (error) {
        console.error("R2 list error:", error);
        if (error instanceof R2ConfigurationError) {
            throw error;
        }
        throw new R2OperationError("Failed to list files in R2", error);
    }
}

function isPublicR2Key(key: string): boolean {
    return key.startsWith("public/");
}

function getR2CacheControl(key: string): string {
    return isPublicR2Key(key)
        ? "public, max-age=31536000, immutable"
        : "private, max-age=0, no-store";
}

export function extractKeyFromUrl(url: string): string {
    return tryExtractR2KeyFromUrl(url) ?? url;
}

export function tryExtractR2KeyFromUrl(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname.replace(/^\/+/, "");
        if (!pathname) {
            return null;
        }

        const publicDomain = normalizeR2Domain(getEnv("R2_PUBLIC_DOMAIN"));
        if (publicDomain && parsedUrl.hostname === publicDomain) {
            return pathname;
        }

        const endpoint = resolveR2Endpoint();
        if (endpoint) {
            const endpointHost = new URL(endpoint).hostname;
            if (parsedUrl.hostname === endpointHost) {
                const bucketName = getEnv("R2_BUCKET_NAME") || "";
                if (bucketName && pathname.startsWith(`${bucketName}/`)) {
                    return pathname.slice(bucketName.length + 1);
                }
                return pathname;
            }
        }

        const bucketName = getEnv("R2_BUCKET_NAME") || "";
        const accountId = resolveR2AccountId();
        if (bucketName && accountId && parsedUrl.hostname === `${bucketName}.${accountId}.r2.dev`) {
            return pathname;
        }
    } catch {
        return null;
    }

    return null;
}

export function validateR2Config(): void {
    const config = resolveR2Config();

    if (getEnv("R2_ACCOUNT_ID")) {
        console.log(`R2 configured with Account ID: ${getEnv("R2_ACCOUNT_ID")}`);
    } else {
        console.log(`R2 configured with Endpoint: ${config.endpoint}`);
    }

    if (!config.publicDomain) {
        console.warn(
            "R2_PUBLIC_DOMAIN not configured - using presigned URLs (valid for 7 days)"
        );
    }
}
