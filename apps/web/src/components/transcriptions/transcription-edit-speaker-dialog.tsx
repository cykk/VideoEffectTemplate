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
import { validateSpeakerDisplayName } from "@markless/shared/src/lib/transcriptions/speaker-display-name";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionEditSpeakerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranscriptionsPageDictionary["speakerEditDialog"];
  initialName: string;
  isSaving?: boolean;
  onApply: (displayName: string) => void | Promise<void>;
  onApplyToAll: (displayName: string) => void | Promise<void>;
};

export function TranscriptionEditSpeakerDialog({
  open,
  onOpenChange,
  dict,
  initialName,
  isSaving = false,
  onApply,
  onApplyToAll,
}: TranscriptionEditSpeakerDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<"apply" | "apply_to_all" | null>(null);

  useEffect(() => {
    if (!open) {
      setSavingAction(null);
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

  useEffect(() => {
    if (!isSaving) {
      setSavingAction(null);
    }
  }, [isSaving]);

  const validateAndNormalize = () => {
    const validation = validateSpeakerDisplayName(name);
    if (!validation.ok) {
      setErrorMessage(
        validation.error === "too_long" ? dict.validationTooLong : dict.validationEmpty
      );
      return null;
    }

    if (validation.normalized === initialName.trim()) {
      onOpenChange(false);
      return null;
    }

    setErrorMessage(null);
    return validation.normalized;
  };

  const handleApply = async () => {
    const normalized = validateAndNormalize();
    if (!normalized) {
      return;
    }

    setSavingAction("apply");
    await onApply(normalized);
  };

  const handleApplyToAll = async () => {
    const normalized = validateAndNormalize();
    if (!normalized) {
      return;
    }

    setSavingAction("apply_to_all");
    await onApplyToAll(normalized);
  };

  const isApplySaving = isSaving && savingAction === "apply";
  const isApplyToAllSaving = isSaving && savingAction === "apply_to_all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10010]"
        showCloseButton={false}
        className="z-[10011] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-8 shadow-xl sm:max-w-[500px]"
        onInteractOutside={(event) => {
          if (isSaving) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (isSaving) {
            event.preventDefault();
          }
        }}
      >
        <DialogClose
          disabled={isSaving}
          className="absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
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
              "focus-visible:border-primary focus-visible:ring-0 focus-visible:outline-none"
            )}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleApplyToAll();
              }
            }}
          />
          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
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
            variant="outline"
            className="h-10 px-5"
            disabled={isSaving}
            aria-busy={isApplySaving}
            onClick={() => void handleApply()}
          >
            {isApplySaving ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {dict.applyPending}
              </>
            ) : (
              dict.applyButton
            )}
          </Button>
          <Button
            type="button"
            className="h-10 px-5"
            disabled={isSaving}
            aria-busy={isApplyToAllSaving}
            onClick={() => void handleApplyToAll()}
          >
            {isApplyToAllSaving ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {dict.applyToAllPending}
              </>
            ) : (
              dict.applyToAllButton
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
