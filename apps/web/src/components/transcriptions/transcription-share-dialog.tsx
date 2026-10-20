"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranscriptionsPageDictionary["shareDialog"];
  enabled: boolean;
  shareUrl: string | null;
  isLoading: boolean;
  isMutating: boolean;
  onEnable: () => void | Promise<void>;
  onDisable: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
};

export function TranscriptionShareDialog({
  open,
  onOpenChange,
  dict,
  enabled,
  shareUrl,
  isLoading,
  isMutating,
  onEnable,
  onDisable,
  onCopy,
}: TranscriptionShareDialogProps) {
  const [isCopied, setIsCopied] = useState(false);

  const isBusy = isLoading || isMutating;
  const hasActiveLink = enabled && Boolean(shareUrl);

  useEffect(() => {
    if (!open) {
      setIsCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timer = window.setTimeout(() => setIsCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = async () => {
    await onCopy();
    setIsCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10010]"
        showCloseButton={false}
        className="z-[10011] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-9 shadow-xl sm:max-w-[500px]"
      >
        <DialogClose
          className="absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={dict.closeAria}
        >
          <X className="size-4" aria-hidden="true" />
        </DialogClose>

        <div className="space-y-2 pr-8">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">
            {dict.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-500">
            {dict.description}
          </DialogDescription>
        </div>

        <div className="mt-8 flex min-h-[140px] flex-col space-y-5">
          <div className="flex-1 space-y-4">
          {hasActiveLink ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-slate-700">{dict.statusEnabled}</p>
              </div>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl ?? ""}
                  aria-label={dict.linkLabel}
                  className="h-10 min-w-0 flex-1 bg-slate-50 text-sm"
                />
                <Button
                  type="button"
                  className="h-10 shrink-0 px-4"
                  onClick={() => void handleCopy()}
                  disabled={isBusy}
                >
                  {isCopied ? dict.copyCopiedButton : dict.copyButton}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {isBusy && isMutating ? dict.enablePending : dict.statusDisabled}
              </p>
              {!(isBusy && isMutating) ? (
                <p className="text-sm leading-relaxed text-slate-500">
                  {dict.statusDisabledHint}
                </p>
              ) : null}
            </div>
          )}
          </div>

          <div className="pt-1">
          {hasActiveLink ? (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 w-full border-red-200 bg-white text-red-600",
                "hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              )}
              onClick={() => void onDisable()}
              disabled={isBusy}
            >
              {isMutating ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  {dict.revokePending}
                </>
              ) : (
                dict.disableButton
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => void onEnable()}
              disabled={isBusy}
            >
              {isMutating ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  {dict.enablePending}
                </>
              ) : (
                dict.enableButton
              )}
            </Button>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

