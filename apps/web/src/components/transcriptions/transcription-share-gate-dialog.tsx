"use client";

import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionShareGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dict: TranscriptionsPageDictionary["shareGate"];
  onSignUp: () => void;
};

export function TranscriptionShareGateDialog({
  open,
  onOpenChange,
  dict,
  onSignUp,
}: TranscriptionShareGateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10010]"
        showCloseButton={false}
        className="z-[10011] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-xl sm:max-w-[420px]"
      >
        <DialogClose
          className="absolute top-4 right-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={dict.closeAria}
        >
          <X className="size-4" aria-hidden="true" />
        </DialogClose>

        <div className="flex flex-col items-center text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
            <Share2 className="size-6" aria-hidden="true" />
          </span>

          <DialogTitle className="mt-5 text-lg font-semibold text-slate-900">
            {dict.title}
          </DialogTitle>

          <DialogDescription className="mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-500">
            {dict.description}
          </DialogDescription>

          <Button type="button" className="mt-8 h-11 w-full" onClick={onSignUp}>
            {dict.signUpButton}
          </Button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-4 cursor-pointer text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            {dict.cancelButton}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

