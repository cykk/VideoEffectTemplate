"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateTranscriptionDisplayTitle } from "@markless/shared/src/lib/transcriptions/display-title";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionRenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranscriptionsPageDictionary["renameDialog"];
  initialName: string;
  isSaving?: boolean;
  onRename: (displayTitle: string) => void | Promise<void>;
};

export function TranscriptionRenameDialog({
  open,
  onOpenChange,
  dict,
  initialName,
  isSaving = false,
  onRename,
}: TranscriptionRenameDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initialName);
    setErrorMessage(null);

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [initialName, open]);

  const handleSubmit = async () => {
    const validation = validateTranscriptionDisplayTitle(name);
    if (!validation.ok) {
      setErrorMessage(
        validation.error === "too_long" ? dict.validationTooLong : dict.validationEmpty
      );
      return;
    }

    if (validation.normalized === initialName.trim()) {
      onOpenChange(false);
      return;
    }

    setErrorMessage(null);
    await onRename(validation.normalized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10010]"
        showCloseButton={false}
        className="z-[10011] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-xl sm:max-w-[500px]"
      >
        <DialogClose
          className="absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={dict.closeAria}
        >
          <X className="size-4" aria-hidden="true" />
        </DialogClose>

        <DialogTitle className="pr-8 text-xl font-semibold tracking-tight text-slate-900">
          {dict.title}
        </DialogTitle>

        <div className="mt-6 space-y-2">
          <Input
            ref={inputRef}
            id={inputId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            aria-label={dict.inputAria}
            aria-invalid={Boolean(errorMessage)}
            disabled={isSaving}
            className={cn(
              "h-11 border-slate-200 text-sm shadow-none",
              "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            )}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-5"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            {dict.cancelButton}
          </Button>
          <Button
            type="button"
            className="h-10 px-5"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {dict.savePending}
              </>
            ) : (
              dict.saveButton
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

