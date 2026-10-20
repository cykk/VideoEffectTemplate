import { toast } from "sonner";
import { toastErrorOptions } from "@markless/shared/src/lib/toast-options";
import type { ApiErrorCode, ApiErrorResponse } from "@markless/shared/src/types/api/video";
import { API_ERROR_CODES } from "@markless/shared/src/types/api/video";

interface FriendlyToastMessage {
  title: string;
  description: string;
}

interface FriendlyApiErrorMessages {
  invalidInput?: FriendlyToastMessage;
  invalidImage?: FriendlyToastMessage;
  uploadFailed?: FriendlyToastMessage;
  serverBusy?: FriendlyToastMessage;
  systemError?: FriendlyToastMessage;
  accessDenied?: FriendlyToastMessage;
  unexpectedError?: FriendlyToastMessage;
}

export interface ErrorHandlerContext {
  setShowAuthModal: (show: boolean) => void;
  setShowUpgradeModal: (show: boolean) => void;
  setError: (error: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  dictionary: {
    interface: {
      toast: {
        errorOccurred: string;
        friendlyErrors?: FriendlyApiErrorMessages;
      };
    };
  };
}

type ErrorHandler = (
  context: ErrorHandlerContext,
  message: string,
  details?: unknown,
) => void;

const FRIENDLY_ERROR_MESSAGE_KEYS: Partial<
  Record<ApiErrorCode, keyof FriendlyApiErrorMessages>
> = {
  [API_ERROR_CODES.INVALID_PARAMS]: "invalidInput",
  [API_ERROR_CODES.MISSING_REQUIRED_FIELDS]: "invalidInput",
  [API_ERROR_CODES.IMAGE_PROCESSING_FAILED]: "invalidImage",
  [API_ERROR_CODES.IMAGE_UPLOAD_FAILED]: "uploadFailed",
  [API_ERROR_CODES.TASK_CREATION_FAILED]: "serverBusy",
  [API_ERROR_CODES.INTERNAL_ERROR]: "systemError",
  [API_ERROR_CODES.CALC_ERROR]: "systemError",
  [API_ERROR_CODES.FORBIDDEN]: "accessDenied",
};

function getFallbackFriendlyMessage(
  context: ErrorHandlerContext,
  defaultMessage: string,
): FriendlyToastMessage {
  return {
    title: context.dictionary.interface.toast.errorOccurred,
    description:
      defaultMessage || context.dictionary.interface.toast.errorOccurred,
  };
}

function getFriendlyMessage(
  context: ErrorHandlerContext,
  code: ApiErrorCode,
  defaultMessage: string,
): FriendlyToastMessage {
  const key = FRIENDLY_ERROR_MESSAGE_KEYS[code];
  const friendlyMessage = key
    ? context.dictionary.interface.toast.friendlyErrors?.[key]
    : undefined;

  return friendlyMessage ?? getFallbackFriendlyMessage(context, defaultMessage);
}

function showApiErrorToast(message: FriendlyToastMessage) {
  toast.error(message.title, {
    ...toastErrorOptions,
    description: message.description,
  });
}

const ERROR_HANDLERS: Partial<Record<ApiErrorCode, ErrorHandler>> = {
  [API_ERROR_CODES.UNAUTHORIZED]: (context) => {
    console.log("[Auth] User not logged in, showing auth modal");
    context.setShowAuthModal(true);
    context.setIsGenerating(false);
  },

  [API_ERROR_CODES.INSUFFICIENT_CREDITS]: (context) => {
    console.log("[Credits] Insufficient credits, showing upgrade modal");
    context.setShowUpgradeModal(true);
    context.setIsGenerating(false);
  },

  [API_ERROR_CODES.INVALID_PARAMS]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.INVALID_PARAMS,
      message,
    );
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.MISSING_REQUIRED_FIELDS]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.MISSING_REQUIRED_FIELDS,
      message,
    );
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.IMAGE_PROCESSING_FAILED]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.IMAGE_PROCESSING_FAILED,
      message,
    );
    context.setError(message);
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.IMAGE_UPLOAD_FAILED]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.IMAGE_UPLOAD_FAILED,
      message,
    );
    context.setError(message);
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.TASK_CREATION_FAILED]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.TASK_CREATION_FAILED,
      message,
    );
    context.setError(message);
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.INTERNAL_ERROR]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.INTERNAL_ERROR,
      message,
    );
    context.setError(message);
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },

  [API_ERROR_CODES.CALC_ERROR]: (context, message) => {
    const friendlyMessage = getFriendlyMessage(
      context,
      API_ERROR_CODES.CALC_ERROR,
      message,
    );
    context.setError(message);
    context.setIsGenerating(false);
    showApiErrorToast(friendlyMessage);
  },
};

const DEFAULT_ERROR_HANDLER: ErrorHandler = (context, message) => {
  console.error("[Error] Unknown error:", message);
  context.setError(message);
  context.setIsGenerating(false);

  const fallbackMessage =
    context.dictionary.interface.toast.friendlyErrors?.unexpectedError ??
    getFallbackFriendlyMessage(context, message);

  showApiErrorToast(fallbackMessage);
};

export function handleApiError(
  errorResponse: ApiErrorResponse,
  context: ErrorHandlerContext,
): void {
  const { code, message, details } = errorResponse.error;
  const handler = ERROR_HANDLERS[code] ?? DEFAULT_ERROR_HANDLER;

  handler(context, message, details);
}

export function handleApiErrorSimple(
  code: ApiErrorCode,
  message: string,
  context: ErrorHandlerContext,
  details?: unknown,
): void {
  const handler = ERROR_HANDLERS[code] ?? DEFAULT_ERROR_HANDLER;
  handler(context, message, details);
}
