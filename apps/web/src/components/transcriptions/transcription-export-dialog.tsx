"use client";

import { useEffect, useState } from "react";
import {
    Download,
    File,
    FileText,
    FileType,
    Info,
    LoaderCircle,
    Sheet,
    Subtitles,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@markless/shared/src/lib/utils";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

export type TranscriptionExportFormat =
    | "txt"
    | "docx"
    | "pdf"
    | "csv"
    | "srt"
    | "vtt";

export type SubtitleLayoutOptions = {
    maxCharsPerCue: number;
    maxDurationSeconds: number;
};

export type TranscriptionExportOptions = {
    format: TranscriptionExportFormat;
    showSpeakerNames: boolean;
    showTimestamps: boolean;
    subtitleLayout?: SubtitleLayoutOptions;
};

const EXPORT_FORMATS: Array<{
    id: TranscriptionExportFormat;
    icon: typeof FileText;
}> = [
    { id: "txt", icon: FileText },
    { id: "docx", icon: FileType },
    { id: "pdf", icon: File },
    { id: "csv", icon: Sheet },
    { id: "srt", icon: Subtitles },
    { id: "vtt", icon: Subtitles },
];

function isSubtitleExportFormat(
    format: TranscriptionExportFormat,
): format is "srt" | "vtt" {
    return format === "srt" || format === "vtt";
}

interface TranscriptionExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dictionary: TranscriptionsPageDictionary["exportDialog"];
    onExport: (options: TranscriptionExportOptions) => void;
    isExporting?: boolean;
    hasEditedSegments?: boolean;
}

export function TranscriptionExportDialog({
    open,
    onOpenChange,
    dictionary,
    onExport,
    isExporting = false,
    hasEditedSegments = false,
}: TranscriptionExportDialogProps) {
    const [selectedFormat, setSelectedFormat] =
        useState<TranscriptionExportFormat>("txt");
    const [showSpeakerNames, setShowSpeakerNames] = useState(false);
    const [showTimestamps, setShowTimestamps] = useState(false);

    const isSubtitleFormat = isSubtitleExportFormat(selectedFormat);
    const showEditedTimingNotice = isSubtitleFormat && hasEditedSegments;

    useEffect(() => {
        if (!open) {
            return;
        }

        setSelectedFormat("txt");
        setShowSpeakerNames(false);
        setShowTimestamps(false);
    }, [open]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && isExporting) {
            return;
        }

        onOpenChange(nextOpen);
    };

    const handleExport = () => {
        onExport({
            format: selectedFormat,
            showSpeakerNames,
            showTimestamps,
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-xl border-slate-200 p-0 shadow-lg sm:max-w-[480px]"
                overlayClassName="bg-slate-900/25 backdrop-blur-none"
                showCloseButton={false}
                aria-describedby="transcription-export-dialog-description"
                aria-busy={isExporting}
                onInteractOutside={(event) => {
                    if (isExporting) {
                        event.preventDefault();
                    }
                }}
                onEscapeKeyDown={(event) => {
                    if (isExporting) {
                        event.preventDefault();
                    }
                }}
            >
                <div className="relative shrink-0 border-b border-slate-100 px-6 py-5">
                    <DialogTitle className="pr-10 text-lg font-semibold text-slate-900">
                        {dictionary.title}
                    </DialogTitle>
                    <p
                        id="transcription-export-dialog-description"
                        className="mt-1 text-sm text-slate-500"
                    >
                        {dictionary.description}
                    </p>
                    <button
                        type="button"
                        onClick={() => handleOpenChange(false)}
                        disabled={isExporting}
                        className="absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        aria-label={dictionary.closeAria}
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>

                {isExporting ? (
                    <p className="sr-only" aria-live="polite">
                        {dictionary.exportingAria}
                    </p>
                ) : null}

                <div
                    className={cn(
                        "min-h-0 flex-1 overflow-y-auto px-6 py-6 transition-opacity",
                        isExporting && "pointer-events-none opacity-60",
                    )}
                >
                    <div className="space-y-6">
                        <section className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900">
                                {dictionary.formatSectionTitle}
                            </h3>
                            <div
                                className="grid grid-cols-2 gap-3"
                                role="radiogroup"
                                aria-label={dictionary.formatSectionTitle}
                            >
                                {EXPORT_FORMATS.map(
                                    ({ id, icon: FormatIcon }) => {
                                        const isSelected =
                                            selectedFormat === id;
                                        const formatLabel =
                                            dictionary.formats[id];
                                        const formatAria =
                                            dictionary.formatAria.replace(
                                                "{format}",
                                                formatLabel,
                                            );

                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                aria-label={formatAria}
                                                aria-disabled={isExporting}
                                                disabled={isExporting}
                                                onClick={() =>
                                                    setSelectedFormat(id)
                                                }
                                                className={cn(
                                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed sm:gap-3 sm:px-4 sm:py-4",
                                                    isSelected
                                                        ? "border-primary bg-primary/10"
                                                        : "border-slate-200 bg-white hover:border-slate-300",
                                                )}
                                            >
                                                <FormatIcon
                                                    className={cn(
                                                        "size-5 shrink-0",
                                                        isSelected
                                                            ? "text-primary"
                                                            : "text-slate-400",
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span
                                                    className={cn(
                                                        "text-xs font-medium sm:text-sm",
                                                        isSelected
                                                            ? "text-slate-900"
                                                            : "text-slate-700",
                                                    )}
                                                >
                                                    {formatLabel}
                                                </span>
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                                {dictionary.optionsSectionTitle}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                                <label
                                    className={cn(
                                        "inline-flex items-center gap-2.5",
                                        isExporting
                                            ? "cursor-not-allowed"
                                            : "cursor-pointer",
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={showSpeakerNames}
                                        disabled={isExporting}
                                        onChange={(event) =>
                                            setShowSpeakerNames(
                                                event.target.checked,
                                            )
                                        }
                                        className="size-4 shrink-0 cursor-pointer rounded border-slate-300 text-primary accent-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-sm text-slate-700">
                                        {dictionary.showSpeakerNames}
                                    </span>
                                </label>
                                {!isSubtitleFormat ? (
                                    <label
                                        className={cn(
                                            "inline-flex items-center gap-2.5",
                                            isExporting
                                                ? "cursor-not-allowed"
                                                : "cursor-pointer",
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={showTimestamps}
                                            disabled={isExporting}
                                            onChange={(event) =>
                                                setShowTimestamps(
                                                    event.target.checked,
                                                )
                                            }
                                            className="size-4 shrink-0 cursor-pointer rounded border-slate-300 text-primary accent-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm text-slate-700">
                                            {dictionary.showTimestamps}
                                        </span>
                                    </label>
                                ) : null}
                            </div>
                        </section>

                        {showEditedTimingNotice ? (
                            <div
                                role="note"
                                className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3"
                            >
                                <Info
                                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                                    aria-hidden="true"
                                />
                                <p className="text-sm text-amber-950">
                                    {
                                        dictionary.subtitleLayout
                                            .editedTimingNotice.message
                                    }
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="shrink-0 border-t border-slate-100 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
                    <Button
                        type="button"
                        className="h-11 w-full gap-2 bg-primary text-base font-semibold text-white shadow-none hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-80"
                        onClick={handleExport}
                        disabled={isExporting}
                        aria-busy={isExporting}
                    >
                        {isExporting ? (
                            <>
                                <LoaderCircle
                                    className="size-5 animate-spin"
                                    aria-hidden="true"
                                />
                                {dictionary.exportPending}
                            </>
                        ) : (
                            <>
                                <Download
                                    className="size-5"
                                    aria-hidden="true"
                                />
                                {dictionary.exportButton}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
