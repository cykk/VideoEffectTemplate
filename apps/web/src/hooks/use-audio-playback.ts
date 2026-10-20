"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptionDisplaySegment } from "@markless/shared/src/types/transcriptions";

export function useAudioPlayback(options: {
  playbackUrl: string | null;
  segments: TranscriptionDisplaySegment[];
  enabled: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(0);

  const playbackSpeed = PLAYBACK_SPEED_OPTIONS[playbackSpeedIndex] ?? 1;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !options.enabled || !options.playbackUrl) {
      return;
    }

    if (audio.src !== options.playbackUrl) {
      audio.src = options.playbackUrl;
      audio.load();
    }
  }, [options.enabled, options.playbackUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);

      if (pendingSeekSecRef.current !== null) {
        audio.currentTime = pendingSeekSecRef.current;
        pendingSeekSecRef.current = null;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTimeSec(audio.currentTime);
      const currentTimeMs = Math.floor(audio.currentTime * 1000);
      const currentSegment =
        options.segments.find(
          (segment) =>
            segment.startMs <= currentTimeMs && currentTimeMs < segment.endMs
        ) ?? null;
      setActiveSegmentId(currentSegment?.id ?? null);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [options.segments]);

  const playFromSecond = useCallback(
    async (startSecond: number, nextActiveSegmentId: string | null) => {
      const audio = audioRef.current;
      if (!audio || !options.playbackUrl) {
        return;
      }

      if (!audio.src) {
        pendingSeekSecRef.current = startSecond;
        audio.src = options.playbackUrl;
        audio.load();
      } else {
        audio.currentTime = startSecond;
      }

      await audio.play();
      setIsPlaying(true);
      setActiveSegmentId(nextActiveSegmentId);
    },
    [options.playbackUrl]
  );

  const handleTogglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !options.playbackUrl) {
      return;
    }

    if (audio.paused) {
      if (!audio.src) {
        const firstSegment = options.segments[0];
        await playFromSecond(
          firstSegment ? firstSegment.startMs / 1000 : 0,
          firstSegment?.id ?? null
        );
        return;
      }

      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }, [options.playbackUrl, options.segments, playFromSecond]);

  const handleSeekRelative = useCallback((offsetSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const maxDuration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    audio.currentTime = Math.max(0, Math.min(maxDuration, audio.currentTime + offsetSeconds));
  }, []);

  const handleSeekToPercent = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    const clampedPercent = Math.min(100, Math.max(0, percent));
    audio.currentTime = (clampedPercent / 100) * audio.duration;
  }, []);

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = Math.max(0, Math.min(1, nextVolume / 100));
  }, []);

  const handlePlaySegment = useCallback(
    async (segment: TranscriptionDisplaySegment) => {
      await playFromSecond(segment.startMs / 1000, segment.id);
    },
    [playFromSecond]
  );

  const handleSegmentSelect = useCallback((segmentId: string) => {
    setActiveSegmentId(segmentId);
  }, []);

  const progressPercent =
    durationSec > 0 ? Math.min(100, Math.max(0, (currentTimeSec / durationSec) * 100)) : 0;

  return {
    audioRef,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeedIndex,
    currentTimeSec,
    durationSec,
    activeSegmentId,
    progressPercent,
    handleTogglePlay,
    handleSeekRelative,
    handleSeekToPercent,
    handleVolumeChange,
    handlePlaySegment,
    handleSegmentSelect,
  };
}

export const PLAYBACK_SPEED_OPTIONS = [1, 1.25, 1.5, 2] as const;

export function formatPlaybackTimeLabel(totalSeconds: number, fallback: string): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return fallback;
  }

  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatPlaybackSpeed(speed: number): string {
  return speed === 1 ? "1x" : `${speed}x`;
}

