import { cn } from "@markless/shared/src/lib/utils";

export const TRANSCRIPTION_ICON_BUTTON_INTERACTION_CLASSNAME =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary active:bg-slate-100 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

export const TRANSCRIPTION_SECONDARY_ICON_BUTTON_CLASSNAME = cn(
  TRANSCRIPTION_ICON_BUTTON_INTERACTION_CLASSNAME,
  "size-9 xl:size-7"
);

export const TRANSCRIPTION_HEADER_BACK_BUTTON_CLASSNAME =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md gap-1 h-9 px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-100 active:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 xl:h-8";

export const TRANSCRIPTION_HEADER_EXPORT_BUTTON_CLASSNAME =
  "ml-3 gap-2 bg-primary text-white shadow-none hover:bg-primary/90 hover:shadow-sm active:scale-[0.98] active:bg-primary/80 focus-visible:ring-2 focus-visible:ring-primary/30";

export const TRANSCRIPTION_SEARCH_REPLACE_INSET_CLASSNAME =
  "top-2 right-2 lg:top-3 lg:right-3";

export const TRANSCRIPTION_INLINE_INPUT_CLASSNAME =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 transition-[color,box-shadow,border-color] hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

export const SHOW_TRANSCRIPTION_SPEAKER_OPTIONS_BUTTON = false;
