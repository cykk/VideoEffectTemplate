"use client";

import type { ReactElement } from "react";
import {
  ClipboardList,
  Copy,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export const SUMMARY_TEMPLATE_SELECT_TRIGGER_CLASSNAME =
  "flex h-8 min-w-[120px] cursor-pointer items-center justify-between gap-2 truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-700 shadow-xs outline-none transition-[color,box-shadow] hover:border-slate-300 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20 data-[state=closed]:focus-visible:border-slate-200 data-[state=closed]:focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const SUMMARY_TEMPLATE_SELECT_ITEM_CLASSNAME =
  "cursor-pointer py-2 text-sm font-medium text-slate-700 focus:bg-slate-100 focus:text-slate-700 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-700 data-[state=checked]:text-slate-700 data-[state=checked]:[&_svg]:text-primary";

export const SUMMARY_TEMPLATE_SELECT_CONTENT_CLASSNAME =
  "w-[var(--radix-select-trigger-width)] rounded-lg border-slate-200 shadow-md";

const SUMMARY_ACTION_ICON_BUTTON_BASE =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

export function getSummaryActionButtonClassName({
  variant,
  isSummaryEnabled,
  isEnabled,
}: {
  variant: "refresh" | "copy";
  isSummaryEnabled: boolean;
  isEnabled: boolean;
}): string {
  void variant;

  if (!isSummaryEnabled) {
    return cn(
      SUMMARY_ACTION_ICON_BUTTON_BASE,
      "cursor-not-allowed text-slate-300"
    );
  }

  if (!isEnabled) {
    return cn(
      SUMMARY_ACTION_ICON_BUTTON_BASE,
      "cursor-not-allowed text-slate-400"
    );
  }

  return cn(
    SUMMARY_ACTION_ICON_BUTTON_BASE,
    "cursor-pointer text-slate-600 hover:bg-slate-50 hover:text-primary active:bg-slate-100 active:text-primary"
  );
}

function SegmentActionTooltip({
  label,
  children,
  align,
  side = "top",
}: {
  label: string;
  children: ReactElement;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} align={align}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type SummaryPanelDict = TranscriptionsPageDictionary["summaryPanel"];

export function TranscriptionSummaryPanelTabs({
  activeTab,
  dict,
  disabled = false,
  onSummaryClick,
  onMindmapClick,
}: {
  activeTab: "summary" | "mindmap";
  dict: SummaryPanelDict;
  disabled?: boolean;
  onSummaryClick?: () => void;
  onMindmapClick?: () => void;
}) {
  return (
    <div className="mb-6 flex items-center gap-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onSummaryClick}
        className={cn(
          "relative inline-flex items-center pb-2 text-base font-semibold transition-colors",
          activeTab === "summary"
            ? "text-primary"
            : "text-slate-500 hover:text-slate-700",
          disabled ? "cursor-default opacity-100" : "cursor-pointer"
        )}
      >
        {dict.tabs.summary}
        {activeTab === "summary" ? (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
        ) : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onMindmapClick}
        className={cn(
          "relative inline-flex items-center pb-2 text-base font-semibold transition-colors",
          activeTab === "mindmap"
            ? "text-primary"
            : "text-slate-500 hover:text-slate-700",
          disabled ? "cursor-default opacity-60" : "cursor-pointer"
        )}
      >
        {dict.tabs.mindmap}
        {activeTab === "mindmap" ? (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
        ) : null}
      </button>
    </div>
  );
}

export function TranscriptionSummaryTemplateToolbar({
  dict,
  templateKey,
  isSummaryEnabled,
  canRefreshSummary,
  canCopySummary,
  disabled = false,
  onTemplateChange,
  onRefresh,
  onCopy,
  selectTriggerRef,
}: {
  dict: SummaryPanelDict;
  templateKey: "off" | "general";
  isSummaryEnabled: boolean;
  canRefreshSummary: boolean;
  canCopySummary: boolean;
  disabled?: boolean;
  onTemplateChange?: (value: "off" | "general") => void;
  onRefresh?: () => void;
  onCopy?: () => void;
  selectTriggerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center",
        isSummaryEnabled ? "gap-3" : "gap-2"
      )}
    >
      <Select
        value={templateKey}
        onValueChange={(value: "off" | "general") => onTemplateChange?.(value)}
        disabled={disabled}
      >
        <SelectTrigger
          ref={selectTriggerRef}
          className={SUMMARY_TEMPLATE_SELECT_TRIGGER_CLASSNAME}
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className={SUMMARY_TEMPLATE_SELECT_CONTENT_CLASSNAME}
        >
          <SelectItem
            value="off"
            className={SUMMARY_TEMPLATE_SELECT_ITEM_CLASSNAME}
          >
            {dict.template.off}
          </SelectItem>
          <SelectItem
            value="general"
            className={SUMMARY_TEMPLATE_SELECT_ITEM_CLASSNAME}
          >
            {dict.template.general}
          </SelectItem>
        </SelectContent>
      </Select>
      <div
        className={cn(
          "flex shrink-0 items-center",
          isSummaryEnabled ? "gap-1.5" : "gap-1"
        )}
      >
        <SegmentActionTooltip
          label={dict.actions.regenerateTooltip}
          side="bottom"
        >
          <span className="inline-flex">
            <button
              type="button"
              disabled={disabled || !canRefreshSummary}
              onClick={onRefresh}
              aria-label={dict.actions.refreshAria}
              className={getSummaryActionButtonClassName({
                variant: "refresh",
                isSummaryEnabled,
                isEnabled: canRefreshSummary && !disabled,
              })}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
          </span>
        </SegmentActionTooltip>
        <SegmentActionTooltip label={dict.actions.copyTooltip} side="bottom">
          <span className="inline-flex">
            <button
              type="button"
              disabled={disabled || !canCopySummary}
              onClick={onCopy}
              aria-label={dict.actions.copyAria}
              className={getSummaryActionButtonClassName({
                variant: "copy",
                isSummaryEnabled,
                isEnabled: canCopySummary && !disabled,
              })}
            >
              <Copy className="size-4" aria-hidden="true" />
            </button>
          </span>
        </SegmentActionTooltip>
      </div>
    </div>
  );
}

export function TranscriptionSummaryEmptyState({
  dict,
  onGenerate,
  generateDisabled = false,
  generateDisabledTooltip,
}: {
  dict: SummaryPanelDict;
  onGenerate?: () => void;
  generateDisabled?: boolean;
  generateDisabledTooltip?: string;
}) {
  const generateButton = (
    <Button
      type="button"
      className="mt-6 w-full bg-primary text-white hover:bg-primary/90"
      disabled={generateDisabled}
      onClick={onGenerate}
    >
      {dict.empty.generateCta}
    </Button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-2">
        <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-900">{dict.empty.title}</p>
      </div>

      <div className="mt-5 space-y-4">
        {[
          {
            icon: Lightbulb,
            label: dict.empty.overview,
          },
          {
            icon: ListChecks,
            label: dict.empty.keyPoints,
          },
          {
            icon: ClipboardList,
            label: dict.empty.takeaways,
          },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <row.icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-slate-600">{row.label}</p>
              <div className="h-2.5 w-full rounded bg-slate-100" />
              <div className="h-2.5 w-4/5 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      {generateDisabled && generateDisabledTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">{generateButton}</span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {generateDisabledTooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        generateButton
      )}
    </div>
  );
}

export function TranscriptionSummaryGeneratingState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-slate-700">{message}</p>
    </div>
  );
}

export function TranscriptionSummaryProcessingPanel({
  dict,
  summaryTemplateKey,
  interactive = false,
  onGenerate,
  generateDisabledTooltip,
}: {
  dict: SummaryPanelDict;
  summaryTemplateKey: "off" | "general";
  interactive?: boolean;
  onGenerate?: () => void;
  generateDisabledTooltip?: string;
}) {
  const isSummaryEnabled = summaryTemplateKey === "general";
  const isGenerating = isSummaryEnabled;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        !(isSummaryEnabled && isGenerating) && "space-y-6"
      )}
    >
      <TranscriptionSummaryTemplateToolbar
        dict={dict}
        templateKey={summaryTemplateKey}
        isSummaryEnabled={isSummaryEnabled}
        canRefreshSummary={false}
        canCopySummary={false}
        disabled={!interactive}
      />

      {isSummaryEnabled ? (
        <TranscriptionSummaryGeneratingState message={dict.states.generating} />
      ) : (
        <TranscriptionSummaryEmptyState
          dict={dict}
          onGenerate={onGenerate}
          generateDisabled={!interactive}
          generateDisabledTooltip={generateDisabledTooltip}
        />
      )}
    </div>
  );
}
