import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiSuccessResponse, ApiErrorResponse } from "@markless/shared/src/types/api/video";

/**
 * 统一成功响应辅助函数
 *
 * @param data - 响应数据
 * @param message - 可选的成功消息
 * @returns NextResponse with standardized success format
 *
 * @example
 * return successResponse({ taskId: "123", status: "pending" }, "Task created successfully");
 */
export function successResponse<T>(
    data: T,
    message?: string
): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json({
        success: true,
        data,
        error: null,
        ...(message && { message }),
    });
}

/**
 * 统一错误响应辅助函数
 *
 * @param code - 错误代码（来自 API_ERROR_CODES 枚举）
 * @param message - 错误消息
 * @param status - HTTP 状态码（默认 400）
 * @param details - 可选的错误详情
 * @returns NextResponse with standardized error format
 *
 * @example
 * return errorResponse("UNAUTHORIZED", "Please sign in to continue", 401);
 */
export function errorResponse(
    code: ApiErrorCode,
    message: string,
    status: number = 400,
    details?: unknown
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            data: null,
            error: {
                code,
                message,
                ...(details && { details }),
            },
        },
        { status }
    );
}

/**
 * 认证错误响应（401）
 */
export function unauthorizedResponse(message: string = "Please sign in to continue") {
    return errorResponse("UNAUTHORIZED", message, 401);
}

/**
 * 积分不足错误响应（403）
 */
export function insufficientCreditsResponse(required: number, available: number) {
    return errorResponse(
        "INSUFFICIENT_CREDITS",
        `Insufficient credits. Required: ${required}, Available: ${available}`,
        403,
        { required, available, upgradeUrl: "/pricing" }
    );
}

/**
 * 参数校验错误响应（400）
 */
export function validationErrorResponse(message: string, details?: unknown) {
    return errorResponse("INVALID_PARAMS", message, 400, details);
}

/**
 * 内部服务器错误响应（500）
 */
export function internalErrorResponse(message: string = "An error occurred while processing your request") {
    return errorResponse("INTERNAL_ERROR", message, 500);
}
