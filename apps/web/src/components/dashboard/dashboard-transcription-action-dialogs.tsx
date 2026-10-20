"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  toastConfirmOptions,
  toastErrorOptions,
} from "@markless/shared/src/lib/toast-options";
import { apiFetch } from "@markless/shared/src/lib/http/client";
import type { ApiErrorResponse, ApiSuccessResponse } from "@markless/shared/src/types/api/video";
import {
  TranscriptionExportDialog,
  type TranscriptionExportOptions,
} from "@/components/transcriptions/transcription-export-dialog";
import { TranscriptionShareDialog } from "@/components/transcriptions/transcription-share-dialog";
import { TranscriptionRenameDialog } from "@/components/transcriptions/transcription-rename-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@markless/shared/src/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import { useTranscriptionShare } from "@/hooks/use-transcription-share";
import { trackTranscriptExport } from "@/lib/analytics/project";
import { renameTranscriptionDisplayTitleRequest } from "@/lib/transcriptions/rename-transcription";
import {
  getFileNameFromContentDisposition,
  triggerBrowserDownload,
} from "@/lib/transcriptions/export-download";

export type DashboardTranscriptionActionTarget = {
  publicId: string;
  dialog: "share" | "export" | "rename" | "delete";
  displayName: string;
};

type DashboardTranscriptionActionDialogsProps = {
  target: DashboardTranscriptionActionTarget | null;
  onClose: () => void;
  onRenamed?: (publicId: string, displayTitle: string) => void;
  onDeleted?: (publicId: string) => void | Promise<void>;
};

type ExportErrorPayload = ApiErrorResponse | null;
type DeleteResponse = {
  deleted: boolean;
};

export function DashboardTranscriptionActionDialogs({
  target,
  onClose,
  onRenamed,
  onDeleted,
}: DashboardTranscriptionActionDialogsProps) {
  const { dictionary } = useLocale();
  const exportDialogDict = dictionary.pages.transcriptions.exportDialog;
  const shareDialogDict = dictionary.pages.transcriptions.shareDialog;
  const renameDialogDict = dictionary.pages.transcriptions.renameDialog;
  const deleteDialogDict = dictionary.pages.dashboard.list.deleteDialog;
  const publicId = target?.publicId ?? "";
  const isShareOpen = target?.dialog === "share";
  const isExportOpen = target?.dialog === "export";
  const isRenameOpen = target?.dialog === "rename";
  const isDeleteOpen = target?.dialog === "delete";

  const [isExporting, setIsExporting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const shareToastHandlers = useMemo(
    () => ({
      onError: (message: string) => {
        toast.error(message, toastErrorOptions);
      },
      onCopySuccess: (message: string) => {
        toast.success(message, toastConfirmOptions);
      },
    }),
    []
  );

  const {
    isLoading: isShareDialogLoading,
    isMutating: isShareDialogMutating,
    share,
    loadShare,
    enableShare,
    revokeShare,
    copyShareLink,
  } = useTranscriptionShare({
    publicId,
    dict: shareDialogDict,
    ...shareToastHandlers,
  });

  useEffect(() => {
    if (!isShareOpen || !publicId) {
      return;
    }

    void loadShare().catch(() => undefined);
  }, [isShareOpen, loadShare, publicId]);

  const handleShareDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  const handleExportDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isExporting) {
        return;
      }

      if (!open) {
        onClose();
      }
    },
    [isExporting, onClose]
  );

  const handleRenameDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isRenaming) {
        return;
      }

      if (!open) {
        onClose();
      }
    },
    [isRenaming, onClose]
  );

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDeleting) {
        return;
      }

      if (!open) {
        onClose();
      }
    },
    [isDeleting, onClose]
  );

  const handleRename = useCallback(
    async (displayTitle: string) => {
      if (!publicId) {
        return;
      }

      setIsRenaming(true);

      try {
        const result = await renameTranscriptionDisplayTitleRequest({
          publicId,
          displayTitle,
          fallbackErrorMessage: renameDialogDict.saveError,
        });

        onRenamed?.(publicId, result.displayTitle);
        onClose();
        toast.success(renameDialogDict.saveSuccess, toastConfirmOptions);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : renameDialogDict.saveError,
          toastErrorOptions
        );
      } finally {
        setIsRenaming(false);
      }
    },
    [
      onClose,
      onRenamed,
      publicId,
      renameDialogDict.saveError,
      renameDialogDict.saveSuccess,
    ]
  );

  const handleExport = useCallback(
    async (options: TranscriptionExportOptions) => {
      if (!publicId) {
        return;
      }

      setIsExporting(true);
      const dedupeKey = `dashboard_transcript_export:${publicId}:${options.format}`;
      trackTranscriptExport({
        format: options.format,
        isAuthenticated: true,
        source: "dashboard",
        succeeded: false,
        dedupeKey: `${dedupeKey}:started`,
      });

      try {
        const response = await apiFetch(`/api/transcriptions/${publicId}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(options),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ExportErrorPayload;
          throw new Error(
            payload && !payload.success
              ? payload.error.message
              : exportDialogDict.exportError
          );
        }

        const blob = await response.blob();
        const fallbackFileName = `${publicId}-transcript.${options.format}`;
        const fileName = getFileNameFromContentDisposition(
          response.headers.get("content-disposition"),
          fallbackFileName
        );

        triggerBrowserDownload(blob, fileName);
        trackTranscriptExport({
          format: options.format,
          isAuthenticated: true,
          source: "dashboard",
          succeeded: true,
          dedupeKey: `${dedupeKey}:completed`,
        });
        onClose();
        toast.success(exportDialogDict.exportSuccess, toastConfirmOptions);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : exportDialogDict.exportError,
          toastErrorOptions
        );
      } finally {
        setIsExporting(false);
      }
    },
    [exportDialogDict.exportError, exportDialogDict.exportSuccess, onClose, publicId]
  );

  const handleDelete = useCallback(async () => {
    if (!publicId) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await apiFetch(`/api/transcriptions/${publicId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiSuccessResponse<DeleteResponse>
        | ApiErrorResponse
        | null;

      if (!response.ok || !payload?.success || !payload.data?.deleted) {
        throw new Error(
          payload && !payload.success
            ? payload.error.message
            : deleteDialogDict.toasts.error
        );
      }

      onClose();
      const afterDeleteTask = onDeleted?.(publicId);
      if (afterDeleteTask instanceof Promise) {
        void afterDeleteTask.catch(() => undefined);
      }
      toast.success(deleteDialogDict.toasts.success, toastConfirmOptions);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : deleteDialogDict.toasts.error,
        toastErrorOptions
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteDialogDict.toasts.error, deleteDialogDict.toasts.success, onClose, onDeleted, publicId]);

  if (!target) {
    return null;
  }

  return (
    <>
      <TranscriptionExportDialog
        open={isExportOpen}
        onOpenChange={handleExportDialogOpenChange}
        dictionary={exportDialogDict}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <TranscriptionShareDialog
        open={isShareOpen}
        onOpenChange={handleShareDialogOpenChange}
        dict={shareDialogDict}
        enabled={share?.enabled ?? false}
        shareUrl={share?.shareUrl ?? null}
        isLoading={isShareDialogLoading}
        isMutating={isShareDialogMutating}
        onEnable={async () => {
          await enableShare();
        }}
        onDisable={async () => {
          await revokeShare();
        }}
        onCopy={copyShareLink}
      />

      <TranscriptionRenameDialog
        open={isRenameOpen}
        onOpenChange={handleRenameDialogOpenChange}
        dict={renameDialogDict}
        initialName={target.displayName}
        isSaving={isRenaming}
        onRename={handleRename}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogDict.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogDict.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {deleteDialogDict.cancelButton}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? deleteDialogDict.deleting : deleteDialogDict.confirmButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

