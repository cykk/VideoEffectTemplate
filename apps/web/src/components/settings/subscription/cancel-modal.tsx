"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, Frown, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelUserSubscriptionRequest, resumeUserSubscriptionRequest } from "@/lib/user/subscription-client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@markless/shared/src/lib/utils";
import { useLocale } from "@/hooks/use-locale";
import type { CancelSubscriptionModalDictionary } from "@markless/shared/src/i18n/types";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd?: string;
}

type Step = "benefits" | "survey" | "confirm" | "success";
type SubscriptionActionErrors = CancelSubscriptionModalDictionary["errors"];

const EMPTY_SUBSCRIPTION_ACTION_ERRORS: SubscriptionActionErrors = {
  cancelFailed: "",
  resumeFailed: "",
  unexpectedError: "",
  noActiveSubscription: "",
  noScheduledCancellation: "",
  providerCancellationFailed: "",
  resumeRequiresScheduledCancellation: "",
  resumeExpiredSubscription: "",
  productInfoNotFound: "",
  previewNotImplemented: "",
  unsupportedProvider: "",
  internalPreviewError: "",
  upgradeRejected: "",
};

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  periodEnd,
}: CancelSubscriptionModalProps) {
  const { dictionary } = useLocale();
  const dict = dictionary?.pages?.membership?.cancelSubscriptionModal;
  const [step, setStep] = useState<Step>("benefits");
  const [reason, setReason] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isResuming, setIsResuming] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => {
        setStep("benefits");
        setReason("");
      }, 300);
    }
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    startTransition(async () => {
      try {
        const result = await cancelUserSubscriptionRequest(
          dict?.errors ?? EMPTY_SUBSCRIPTION_ACTION_ERRORS,
        );
        if (result.success) {
          setStep("success"); // 切换到成功步骤而不是关�?modal
        } else {
          alert(result.error || dict?.errors.cancelFailed || "");
        }
      } catch {
        alert(dict?.errors.unexpectedError || "");
      }
    });
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      const result = await resumeUserSubscriptionRequest(
        dict?.errors ?? EMPTY_SUBSCRIPTION_ACTION_ERRORS,
      );
      if (result.success) {
        handleOpenChange(false);
                window.location.reload();
      } else {
        alert(result.error || dict?.errors.resumeFailed || "");
      }
    } catch {
      alert(dict?.errors.unexpectedError || "");
    } finally {
      setIsResuming(false);
    }
  };

  // Benefits Step Content
  const renderBenefitsStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          {dict?.benefits.title}
        </DialogTitle>
        <DialogDescription className="pt-4 text-slate-500">
          {dict?.benefits.description} <strong className="text-slate-700">{periodEnd || dict?.benefits.periodEndFallback}</strong>:
        </DialogDescription>
      </DialogHeader>

      <div className="py-6 space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 border border-slate-200">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <div className="font-medium text-foreground">{dict?.benefits.items.creditAllowance.title}</div>
            <div className="text-sm text-slate-500">{dict?.benefits.items.creditAllowance.description}</div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 border border-slate-200">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <div className="font-medium text-foreground">{dict?.benefits.items.premiumModels.title}</div>
            <div className="text-sm text-slate-500">{dict?.benefits.items.premiumModels.description}</div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 border border-slate-200">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <div className="font-medium text-foreground">{dict?.benefits.items.commercialLicense.title}</div>
            <div className="text-sm text-slate-500">{dict?.benefits.items.commercialLicense.description}</div>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="default"
          className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold shadow-lg cursor-pointer"
          onClick={() => handleOpenChange(false)}
        >
          {dict?.benefits.buttons.keep}
        </Button>
        <Button
          variant="ghost"
          className="w-full sm:w-auto text-slate-500 hover:bg-transparent hover:text-slate-500 cursor-pointer"
          onClick={() => setStep("survey")}
        >
          {dict?.benefits.buttons.continue}
        </Button>
      </DialogFooter>
    </>
  );

  // Survey Step Content
  const renderSurveyStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground">
          <Frown className="w-5 h-5 text-slate-500" />
          {dict?.survey.title}
        </DialogTitle>
        <DialogDescription className="text-slate-500">
          {dict?.survey.description}
        </DialogDescription>
      </DialogHeader>

      <div className="py-6">
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-3">
          <div 
            onClick={() => setReason('too_expensive')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              reason === 'too_expensive' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-neutral-800 hover:border-neutral-700'
            )}
          >
            <RadioGroupItem value="too_expensive" id="r1" className="border-neutral-500 text-indigo-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">{dict?.survey.reasons.tooExpensive}</span>
          </div>
          
          <div 
            onClick={() => setReason('not_using')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              reason === 'not_using' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-neutral-800 hover:border-neutral-700'
            )}
          >
            <RadioGroupItem value="not_using" id="r2" className="border-neutral-500 text-indigo-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">{dict?.survey.reasons.notUsing}</span>
          </div>
          
          <div 
            onClick={() => setReason('missing_features')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              reason === 'missing_features' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-neutral-800 hover:border-neutral-700'
            )}
          >
            <RadioGroupItem value="missing_features" id="r3" className="border-neutral-500 text-indigo-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">{dict?.survey.reasons.missingFeatures}</span>
          </div>
          
          <div 
            onClick={() => setReason('found_alternative')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              reason === 'found_alternative' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-neutral-800 hover:border-neutral-700'
            )}
          >
            <RadioGroupItem value="found_alternative" id="r4" className="border-neutral-500 text-indigo-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">{dict?.survey.reasons.foundAlternative}</span>
          </div>
          
          <div 
            onClick={() => setReason('other')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
              reason === 'other' 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-neutral-800 hover:border-neutral-700'
            )}
          >
            <RadioGroupItem value="other" id="r5" className="border-neutral-500 text-indigo-500" />
            <span className="flex-1 text-sm font-medium text-slate-700">{dict?.survey.reasons.other}</span>
          </div>
        </RadioGroup>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="default"
          onClick={() => setStep("benefits")}
          className="cursor-pointer bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold shadow-lg"
        >
          {dict?.survey.buttons.back}
        </Button>
        <Button
          variant="ghost"
          disabled={!reason}
          onClick={() => setStep("confirm")}
          className={cn(
            "cursor-pointer transition-colors",
            !reason 
              ? "text-slate-500 cursor-not-allowed hover:bg-transparent hover:text-slate-500" 
              : "text-slate-700 hover:bg-transparent hover:text-slate-700"
          )}
        >
          {dict?.survey.buttons.continue}
        </Button>
      </DialogFooter>
    </>
  );

  // Confirm Step Content
  const renderConfirmStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-red-400 flex items-center gap-2">
          <Frown className="w-5 h-5" />
          {dict?.confirm.title}
        </DialogTitle>
        <DialogDescription className="pt-2 text-neutral-300">
          {dict?.confirm.description} <strong>{periodEnd}</strong>.
          <br /><br />
          {dict?.confirm.question}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4"></div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isPending}
          className="bg-transparent border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-foreground cursor-pointer"
        >
          {dict?.confirm.buttons.no}
        </Button>
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={isPending}
          className="bg-red-500/10 text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dict?.confirm.buttons.yes}
        </Button>
      </DialogFooter>
    </>
  );

  // Success Step Content
  const renderSuccessStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-emerald-400">
          <Check className="w-6 h-6" />
          {dict?.success.title}
        </DialogTitle>
        <DialogDescription className="pt-4 text-neutral-300">
          {dict?.success.description} <strong className="text-foreground">{periodEnd}</strong>.
          <br /><br />
          {dict?.success.resumeHint}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4"></div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isResuming}
          className="bg-transparent border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-foreground cursor-pointer"
        >
          {dict?.success.buttons.gotIt}
        </Button>
        <Button
          onClick={handleResume}
          disabled={isResuming}
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold cursor-pointer"
        >
          {isResuming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dict?.success.buttons.resume}
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground shadow-2xl [&>button]:text-slate-500 [&>button]:hover:text-foreground [&>button]:cursor-pointer rounded-3xl">
        {step === "benefits" && renderBenefitsStep()}
        {step === "survey" && renderSurveyStep()}
        {step === "confirm" && renderConfirmStep()}
        {step === "success" && renderSuccessStep()}
      </DialogContent>
    </Dialog>
  );
}


