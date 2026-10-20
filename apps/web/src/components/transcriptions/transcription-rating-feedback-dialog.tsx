"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

const FEEDBACK_MAX_LENGTH = 1000;

interface TranscriptionRatingFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: number;
  dictionary: TranscriptionsPageDictionary["ratingFeedback"];
  onSubmit: (feedback: string) => void;
  isSubmitting?: boolean;
}

export function TranscriptionRatingFeedbackDialog({
  open,
  onOpenChange,
  rating,
  dictionary,
  onSubmit,
  isSubmitting = false,
}: TranscriptionRatingFeedbackDialogProps) {
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    if (open) {
      setFeedbackText("");
    }
  }, [open]);

  const charCountLabel = dictionary.charCount
    .replace("{current}", String(feedbackText.length))
    .replace("{max}", String(FEEDBACK_MAX_LENGTH));

  const starDisplayAria = dictionary.starDisplayAria.replace(
    "{rating}",
    String(rating)
  );

  const handleSubmit = () => {
    onSubmit(feedbackText.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg sm:max-w-[440px]"
        overlayClassName="bg-slate-900/25 backdrop-blur-none"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <div className="relative border-b border-slate-100 px-5 py-4">
          <DialogTitle className="text-center text-base font-semibold text-slate-900">
            {dictionary.title}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label={dictionary.closeAria}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div
            className="flex items-center justify-center gap-1"
            aria-label={starDisplayAria}
            role="img"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={
                  value <= rating
                    ? "size-6 fill-primary text-primary"
                    : "size-6 text-slate-300"
                }
                aria-hidden="true"
              />
            ))}
          </div>

          <p className="text-sm font-medium text-slate-600">
            {dictionary.improvePrompt}
          </p>

          <div className="min-w-0 w-full space-y-1.5 overflow-hidden">
            <Textarea
              value={feedbackText}
              disabled={isSubmitting}
              onChange={(event) => {
                setFeedbackText(event.target.value.slice(0, FEEDBACK_MAX_LENGTH));
              }}
              placeholder={dictionary.placeholder}
              rows={5}
              className="field-sizing-fixed max-w-full min-h-[140px] resize-none overflow-x-hidden overflow-y-auto break-words border-slate-200 bg-white text-sm leading-relaxed text-slate-900 shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <p className="text-right text-xs text-slate-400">{charCountLabel}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {dictionary.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {dictionary.send}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
