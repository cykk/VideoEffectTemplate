export const TOAST_CONFIRM_DURATION_MS = 1500;
export const TOAST_ERROR_DURATION_MS = 4000;

export const toastConfirmOptions = {
  duration: TOAST_CONFIRM_DURATION_MS,
} as const;

export const toastErrorOptions = {
  duration: TOAST_ERROR_DURATION_MS,
} as const;
