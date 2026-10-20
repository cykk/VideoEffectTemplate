/**
 * Zoho ZeptoMail API Integration
 *
 * 涓撲负浜嬪姟閭欢锛堝 Magic Link 鐧诲綍楠岃瘉锛夎璁＄殑楂橀€佽揪鐜囬偖浠舵湇鍔?
 *
 * 閰嶇疆鎸囧崡锛?
 * 1. 娉ㄥ唽 ZeptoMail: https://www.zoho.com/zeptomail/
 * 2. 楠岃瘉鍙戜欢鍩熷悕锛堥渶閰嶇疆 SPF/DKIM锛?
 * 3. 鍒涘缓 Mail Agent: Settings > Mail Agents
 * 4. 鑾峰彇 API Key (Send Mail Token)
 * 5. 閰嶇疆鐜鍙橀噺:
 *    - ZEPTOMAIL_API_KEY: API瀵嗛挜锛堜粎瀵嗛挜閮ㄥ垎锛屼笉鍚?"Zoho-enczapikey" 鍓嶇紑锛?
 *    - ZEPTOMAIL_FROM_EMAIL: 鍙戜欢浜洪偖绠憋紙濡?noreply@watermarkremover.tech锛?
 *    - ZEPTOMAIL_FROM_NAME: 鍙戜欢浜哄悕绉帮紙濡?WatermarkRemover锛屽彲閫夛級
 *    - ZEPTOMAIL_BOUNCE_ADDRESS: 閫€淇″湴鍧€锛堝彲閫夛紝涓嶈缃垯浣跨敤 Mail Agent 榛樿閰嶇疆锛?
 *
 * 閲嶈鎻愮ず锛?
 * - API Key 鍙～鍐欏瘑閽ラ儴鍒嗭紝浠ｇ爜浼氳嚜鍔ㄦ坊鍔?"Zoho-enczapikey" 鍓嶇紑
 * - Bounce Address 鍙互涓嶈缃紝ZeptoMail 浼氫娇鐢?Mail Agent 鐨勯粯璁ら厤缃?
 * - 鍙戜欢閭蹇呴』浣跨敤宸查獙璇佺殑鍩熷悕锛堜笉闇€瑕佺湡瀹炲瓨鍦ㄧ殑閭璐︽埛锛?
 *
 *
 * @see https://www.zoho.com/zeptomail/help/api/
 */

import { getEmailDictionary } from '@markless/shared/src/emails/dictionary';
import { renderMagicLinkEmail } from './renderer';
import { BRAND_CONFIG } from "@markless/shared/src/lib/config/brand";
import { getEnv } from "@markless/shared/src/lib/config/env";


// Types
interface ZeptoMailResponse {
    data: Array<{
        code: string;
        message: string;
        request_id: string;
    }>;
    message: string;
}

interface ZeptoMailError {
    code: string;
    message: string;
    details?: unknown;
}

interface SendEmailOptions {
    to: string;
    subject: string;
    htmlbody: string;
    textbody?: string;
    replyTo?: {
        address: string;
        name?: string;
    };
    cc?: Array<{ address: string; name?: string }>;
    bcc?: Array<{ address: string; name?: string }>;
}


// Retry Configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
    // Type guard helpers
    const hasErrorCode = (err: unknown): err is { code: string } => {
        return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: unknown }).code === 'string';
    };

    const hasStatus = (err: unknown): err is { status: number } => {
        return typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number';
    };

    // Network errors - retry
    if (hasErrorCode(error)) {
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ENETUNREACH') {
            return true;
        }
    }

    // 5xx server errors - retry
    if (hasStatus(error) && error.status >= 500 && error.status < 600) {
        return true;
    }

    // 429 rate limit - retry
    if (hasStatus(error) && error.status === 429) {
        return true;
    }

    // 4xx client errors - don't retry (configuration issue)
    if (hasStatus(error) && error.status >= 400 && error.status < 500) {
        return false;
    }

    // Unknown errors - retry
    return true;
}


// Configuration Validation
function validateConfig(): void {
    const required = [
        'ZEPTOMAIL_API_KEY',
        'ZEPTOMAIL_FROM_EMAIL',
    ];

    const missing = required.filter(key => !getEnv(key));

    if (missing.length > 0) {
        throw new Error(
            `[ZeptoMail] Missing required environment variables: ${missing.join(', ')}\n` +
            `Please configure them in your active API environment file.\n` +
            `See: https://www.zoho.com/zeptomail/help/api/`
        );
    }
}


// API Client
const DEFAULT_ZEPTOMAIL_API_ENDPOINT = 'https://api.zeptomail.com.cn/v1.1/email';
const ZEPTOMAIL_API_ENDPOINT = getEnv("ZEPTOMAIL_API_ENDPOINT") || DEFAULT_ZEPTOMAIL_API_ENDPOINT;

/**
 * Internal: Send email via ZeptoMail API (without retry)
 *
 * @param options - Email sending options
 * @throws {Error} If API call fails or returns error
 */
async function sendEmailInternal(options: SendEmailOptions): Promise<void> {
    validateConfig();

    const { to, subject, htmlbody, textbody, replyTo, cc, bcc } = options;

    const payload = {
        ...(getEnv("ZEPTOMAIL_BOUNCE_ADDRESS") && {
            bounce_address: getEnv("ZEPTOMAIL_BOUNCE_ADDRESS"),
        }),
        from: {
            address: getEnv("ZEPTOMAIL_FROM_EMAIL"),
            name: getEnv("ZEPTOMAIL_FROM_NAME") || getEmailDictionary('en').common.header.logo,
        },
        to: [
            {
                email_address: {
                    address: to,
                },
            },
        ],
        ...(cc && {
            cc: cc.map(item => ({
                email_address: { address: item.address, name: item.name },
            })),
        }),
        ...(bcc && {
            bcc: bcc.map(item => ({
                email_address: { address: item.address, name: item.name },
            })),
        }),
        ...(replyTo && {
            reply_to: [
                {
                    address: replyTo.address,
                    name: replyTo.name,
                },
            ],
        }),
        subject,
        htmlbody,
        ...(textbody && { textbody }),
    };

    console.log(`[ZeptoMail] Sending email to ${to}...`);

    // 璋冭瘯锛氭墦鍗拌姹?payload
    console.log('[ZeptoMail] Request payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(ZEPTOMAIL_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Zoho-enczapikey ${getEnv("ZEPTOMAIL_API_KEY")}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        // 鑾峰彇鍘熷鍝嶅簲鏂囨湰
        const responseText = await response.text();

        console.log('[ZeptoMail] Response status:', response.status);
        console.log('[ZeptoMail] Response headers:', Object.fromEntries(response.headers.entries()));
        console.log('[ZeptoMail] Response body (first 500 chars):', responseText.substring(0, 500));

        // 灏濊瘯瑙ｆ瀽 JSON
        let data: ZeptoMailResponse | ZeptoMailError;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[ZeptoMail] Failed to parse response as JSON');
            console.error('[ZeptoMail] Raw response:', responseText);
            throw new Error(
                `ZeptoMail API returned non-JSON response (${response.status}): ${responseText.substring(0, 200)}`
            );
        }

        if (!response.ok) {
            const error = data as ZeptoMailError;
            console.error('[ZeptoMail] API Error:', {
                status: response.status,
                statusText: response.statusText,
                code: error.code,
                message: error.message,
                details: error.details,
                fullResponse: JSON.stringify(data, null, 2),
            });

            throw new Error(
                `ZeptoMail API error (${response.status}): ${error.message || response.statusText} (${error.code || 'NO_CODE'})`
            );
        }

        const successData = data as ZeptoMailResponse;
        console.log('[ZeptoMail] Email sent successfully:', {
            to,
            request_id: successData.data[0]?.request_id,
            message: successData.message,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('ZeptoMail API error')) {
            throw error;
        }

        console.error('[ZeptoMail] Network error:', error);
        throw new Error(
            `Failed to send email via ZeptoMail: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Send email via ZeptoMail API with automatic retry
 * 
 * Implements exponential backoff retry strategy:
 * - Max retries: 3
 * - Delays: 1s, 2s, 4s
 * - Only retries on network errors and 5xx server errors
 * 
 * @param options - Email sending options
 * @throws {Error} If all retry attempts fail
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await sendEmailInternal(options);

            if (attempt > 1) {
                console.log(`[ZeptoMail] 鉁?Email sent successfully on attempt ${attempt}/${MAX_RETRIES}`);
            }

            return; // Success!
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry
            const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);

            if (!shouldRetry) {
                console.error(`[ZeptoMail] 鉂?Failed to send email (attempt ${attempt}/${MAX_RETRIES}), not retrying`);
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = RETRY_DELAYS[attempt - 1];
            console.warn(
                `[ZeptoMail] 鈿狅笍  Attempt ${attempt}/${MAX_RETRIES} failed, ` +
                `retrying in ${delay}ms... Error: ${error instanceof Error ? error.message : String(error)}`
            );

            await sleep(delay);
        }
    }

    // All retries exhausted
    console.error(`[ZeptoMail] 鉂?All ${MAX_RETRIES} attempts failed`);
    throw lastError || new Error('Failed to send email after multiple retries');
}







/**
 * Send Magic Link email璁よ瘉閭欢
 *
 * @param email - Recipient email address
 * @param magicLinkUrl - Magic link URL for authentication
 *
 * @example
 * await sendMagicLinkEmail('user@example.com', 'https://mp3totext.io/api/auth/magic-link/verify?token=...');
 */
export async function sendMagicLinkEmail(
    email: string,
    magicLinkUrl: string
): Promise<void> {
    const locale = "en";

    // Render email in the single supported locale.
    const { html, text } = await renderMagicLinkEmail(email, magicLinkUrl, locale);
    const copy = getEmailDictionary(locale).magicLink;
    await sendEmail({
        to: email,
        subject: copy.subject,
        htmlbody: html,
        textbody: text,
        replyTo: {
            address: `support@${BRAND_CONFIG.siteDomain}`,
            name: copy.senderName,
        },
    });
}


/**
 * Validate ZeptoMail configuration
 *
 * @returns true if all required environment variables are set
 */
export function isConfigured(): boolean {
    try {
        validateConfig();
        return true;
    } catch {
        return false;
    }
}

/**
 * Get ZeptoMail configuration status
 *
 * @returns Configuration status with details
 */
export function getConfigStatus() {
    return {
        configured: isConfigured(),
        endpoint: ZEPTOMAIL_API_ENDPOINT,
        apiKey: !!getEnv("ZEPTOMAIL_API_KEY"),
        bounceAddress: !!getEnv("ZEPTOMAIL_BOUNCE_ADDRESS"),
        fromEmail: !!getEnv("ZEPTOMAIL_FROM_EMAIL"),
        fromName: getEnv("ZEPTOMAIL_FROM_NAME") || getEmailDictionary('en').common.header.logo,
    };
}

