"use client";

import { useCallback, useRef, useState } from "react";
import {
  FastForward,
  Pause,
  Play,
  Rewind,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@markless/shared/src/lib/utils";
import { formatHumanReadableDuration } from "@/lib/shared-transcription-formatters";
import {
  formatPlaybackSpeed,
  formatPlaybackTimeLabel,
  type PLAYBACK_SPEED_OPTIONS,
} from "@/hooks/use-audio-playback";
import type { TranscriptionsPageDictionary } from "@markless/shared/src/i18n/types";

const PLAYBACK_SECONDARY_BUTTON_CLASSNAME =
  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-primary active:bg-slate-200 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const PLAYBACK_PRIMARY_BUTTON_CLASSNAME =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md transition-[color,transform] duration-150 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const PLAYBACK_SPEED_BUTTON_CLASSNAME =
  "inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md px-2 font-mono text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-primary active:bg-slate-200 active:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const PLAYBACK_TIME_LABEL_CLASSNAME =
  "shrink-0 font-mono text-sm font-normal tabular-nums tracking-tight text-slate-500";

function resolveVolumeIcon(volume: number) {
  if (volume === 0) {
    return VolumeX;
  }

  if (volume <= 33) {
    return Volume;
  }

  if (volume <= 66) {
    return Volume1;
  }

  return Volume2;
}

function PlaybackVolumeControl({
  dict,
  onVolumeChange,
}: {
  dict: TranscriptionsPageDictionary["playback"];
  onVolumeChange: (nextVolume: number) => void;
}) {
  const [volume, setVolume] = useState(100);
  const VolumeIcon = resolveVolumeIcon(volume);

  const handleVolumeChange = (nextVolume: number) => {
    const clampedVolume = Math.min(100, Math.max(0, nextVolume));
    setVolume(clampedVolume);
    onVolumeChange(clampedVolume);
  };

  return (
    <Popover>
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-label={dict.volumeAria}
          className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
        >
          <VolumeIcon className="size-5" aria-hidden="true" />
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={4}
        aria-label={dict.volumePopoverLabel}
        className="w-auto rounded-lg border-slate-200 px-2 py-2 shadow-md"
      >
        <Slider
          orientation="vertical"
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={(values) => handleVolumeChange(values[0] ?? 0)}
          aria-label={dict.volumeSliderAria}
          className="h-16 min-h-16 w-6"
        />
      </PopoverContent>
    </Popover>
  );
}

function PlaybackProgressBar({
  ariaLabel,
  progressPercent,
  currentTimeLabel,
  durationLabel,
  onSeekToPercent,
}: {
  ariaLabel: string;
  progressPercent: number;
  currentTimeLabel: string;
  durationLabel: string;
  onSeekToPercent?: (percent: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !onSeekToPercent) {
        return;
      }

      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const percent = ((clientX - rect.left) / rect.width) * 100;
      onSeekToPercent(percent);
    },
    [onSeekToPercent]
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <span className={PLAYBACK_TIME_LABEL_CLASSNAME}>{currentTimeLabel}</span>
      <div
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedProgress}
        tabIndex={0}
        className="group flex h-4 min-w-0 flex-1 cursor-pointer touch-manipulation items-center focus-visible:outline-none"
        onPointerDown={(event) => {
          if (!onSeekToPercent) {
            return;
          }

          seekFromClientX(event.clientX);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!onSeekToPercent || event.buttons !== 1) {
            return;
          }

          seekFromClientX(event.clientX);
        }}
        onKeyDown={(event) => {
          if (!onSeekToPercent) {
            return;
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onSeekToPercent(Math.max(0, clampedProgress - 5));
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            onSeekToPercent(Math.min(100, clampedProgress + 5));
          }
        }}
      >
        <div
          ref={trackRef}
          className="relative h-1 w-full rounded-full bg-(--color-progress-bg) transition-all duration-150 group-hover:h-1.5 group-focus-visible:h-1.5"
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-(--color-progress-fill) transition-all duration-150"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
      <span className={PLAYBACK_TIME_LABEL_CLASSNAME}>{durationLabel}</span>
    </div>
  );
}

export type TranscriptionPlaybackBarProps = {
  dict: TranscriptionsPageDictionary["playback"];
  durationMs: number | null;
  unknownValue: string;
  isPlaying: boolean;
  playbackSpeed: (typeof PLAYBACK_SPEED_OPTIONS)[number];
  currentTimeSec: number;
  progressPercent: number;
  onTogglePlay: () => void;
  onSeekRelative: (offsetSeconds: number) => void;
  onSeekToPercent?: (percent: number) => void;
  onCycleSpeed: () => void;
  onVolumeChange: (nextVolume: number) => void;
};

export function TranscriptionPlaybackBar({
  dict,
  durationMs,
  unknownValue,
  isPlaying,
  playbackSpeed,
  currentTimeSec,
  progressPercent,
  onTogglePlay,
  onSeekRelative,
  onSeekToPercent,
  onCycleSpeed,
  onVolumeChange,
}: TranscriptionPlaybackBarProps) {
  const durationLabel = formatHumanReadableDuration(durationMs) || unknownValue;
  const currentTimeLabel = formatPlaybackTimeLabel(currentTimeSec, unknownValue);
  const speedLabel = formatPlaybackSpeed(playbackSpeed);
  const speedAriaLabel = dict.speedAria.replace("{speed}", speedLabel);

  return (
    <div className="z-10 flex shrink-0 flex-col border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={dict.skipBackAria}
            onClick={() => onSeekRelative(-10)}
            className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
          >
            <Rewind className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? dict.pauseAria : dict.playAria}
            onClick={onTogglePlay}
            className={PLAYBACK_PRIMARY_BUTTON_CLASSNAME}
          >
            {isPlaying ? (
              <Pause className="size-5.5" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 size-5.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label={dict.skipForwardAria}
            onClick={() => onSeekRelative(10)}
            className={PLAYBACK_SECONDARY_BUTTON_CLASSNAME}
          >
            <FastForward className="size-5" aria-hidden="true" />
          </button>
        </div>

        <PlaybackProgressBar
          ariaLabel={dict.scrubAria}
          progressPercent={progressPercent}
          currentTimeLabel={currentTimeLabel}
          durationLabel={durationLabel}
          onSeekToPercent={onSeekToPercent}
        />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PlaybackVolumeControl dict={dict} onVolumeChange={onVolumeChange} />
          <button
            type="button"
            aria-label={speedAriaLabel}
            onClick={onCycleSpeed}
            className={cn(PLAYBACK_SPEED_BUTTON_CLASSNAME)}
          >
            {speedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

