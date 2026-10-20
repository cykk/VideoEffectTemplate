import { mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { uploadToR2, generateTranscriptionSourceKey } from "@markless/server/src/lib/storage/r2-storage";
import {
  downloadLinkMediaToFile,
  type DownloadedLinkMedia,
} from "@markless/shared/src/lib/transcriptions/link-media";
import {
  probeMediaFileDurationMs,
  prepareAudioFileForTranscription,
} from "@markless/server/src/lib/ffmpeg/video-utils";

export type ImportedLinkMedia = {
  mode: "r2_imported";
  sourceType: "audio" | "video";
  fileName: string;
  fileExtension: string;
  contentType: string;
  fileSizeBytes: number;
  sourceR2Key: string;
  sourceUrl: string;
  preview: DownloadedLinkMedia["preview"];
  durationMs: number | null;
  title: string;
  titleSource: "preview" | "download" | "fallback";
  clippedForProcessing: boolean;
};

function buildTempDir(publicId: string): string {
  return path.join(os.tmpdir(), "transvio", "link-import", publicId);
}

function buildOutputTemplate(tempDir: string): string {
  return path.join(tempDir, "source.%(ext)s");
}

function buildImportedSourceKey(ownerId: string, publicId: string, extension: string): string {
  return generateTranscriptionSourceKey(ownerId, extension).replace(
    "/source/",
    `/source-links/${publicId}/`
  );
}

function isMeaningfulImportedTitle(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "untitled media";
}

function buildImportedProcessingFileName(extension: string): string {
  return extension === "flac" ? "source-clip.flac" : `source.${extension}`;
}

export async function importLinkMediaToR2(input: {
  url: string;
  publicId: string;
  ownerId: string;
  previewTitle?: string | null;
  previewDurationMs?: number | null;
  maxDurationSeconds?: number;
  onUploadStart?: () => Promise<void> | void;
}): Promise<ImportedLinkMedia> {
  const tempDir = buildTempDir(input.publicId);
  await mkdir(tempDir, { recursive: true });
  const importStartedAt = Date.now();

  try {
    console.info("[Transcriptions][Link Import] Downloading source media", {
      publicId: input.publicId,
      ownerId: input.ownerId,
      previewTitle: input.previewTitle ?? null,
      previewDurationMs: input.previewDurationMs ?? null,
      clipFirstRequested:
        Number.isFinite(input.maxDurationSeconds) && Number(input.maxDurationSeconds) > 0,
      maxDurationSeconds:
        Number.isFinite(input.maxDurationSeconds) && Number(input.maxDurationSeconds) > 0
          ? Number(input.maxDurationSeconds)
          : null,
    });

    const downloadStartedAt = Date.now();
    const downloaded: DownloadedLinkMedia = await downloadLinkMediaToFile(
      input.url,
      buildOutputTemplate(tempDir),
      {
        noContinue: true,
      }
    );
    const downloadElapsedMs = Date.now() - downloadStartedAt;

    const probeStartedAt = Date.now();
    const fileStats = await stat(downloaded.filePath);
    const probedDurationMs = await probeMediaFileDurationMs(downloaded.filePath);
    const probeElapsedMs = Date.now() - probeStartedAt;
    const detectedFileSizeBytes = Number(fileStats.size || downloaded.fileSizeBytes || 0);
    const clipDecisionDurationMs =
      input.previewDurationMs ?? probedDurationMs ?? downloaded.durationMs ?? null;
    const effectiveDurationMs =
      probedDurationMs ?? downloaded.durationMs ?? input.previewDurationMs ?? null;
    const finalTitle = isMeaningfulImportedTitle(downloaded.title)
      ? downloaded.title
      : isMeaningfulImportedTitle(input.previewTitle)
        ? String(input.previewTitle).trim()
        : "Untitled media";
    const titleSource =
      isMeaningfulImportedTitle(downloaded.title)
        ? "download"
        : isMeaningfulImportedTitle(input.previewTitle)
          ? "preview"
          : "fallback";
    const shouldClipForProcessing =
      !downloaded.alreadyClippedForProcessing &&
      Number.isFinite(input.maxDurationSeconds) &&
      (input.maxDurationSeconds as number) > 0 &&
      typeof clipDecisionDurationMs === "number" &&
      clipDecisionDurationMs > Math.round(Number(input.maxDurationSeconds) * 1000);

    console.info("[Transcriptions][Link Import] Source media downloaded", {
      publicId: input.publicId,
      sourceType: downloaded.sourceType,
      fileName: downloaded.fileName,
      fileExtension: downloaded.fileExtension,
      contentType: downloaded.contentType,
      fileSizeBytes: downloaded.fileSizeBytes,
      detectedFileSizeBytes,
      previewTitle: input.previewTitle ?? null,
      downloadedTitle: downloaded.title,
      finalTitle,
      titleSource,
      previewDurationMs: input.previewDurationMs ?? null,
      downloadedDurationMs: downloaded.durationMs,
      probedDurationMs,
      downloadElapsedMs,
      probeElapsedMs,
      clipDecisionDurationMs,
      originalDurationMs: effectiveDurationMs,
      clipFirstApplied: shouldClipForProcessing,
      clipMaxDurationMs:
        Number.isFinite(input.maxDurationSeconds) && Number(input.maxDurationSeconds) > 0
          ? Math.round(Number(input.maxDurationSeconds) * 1000)
          : null,
    });

    const trimStartedAt = Date.now();
    const preparedAudioBuffer = shouldClipForProcessing
      ? await prepareAudioFileForTranscription({
          inputPath: downloaded.filePath,
          maxDurationSeconds: Number(input.maxDurationSeconds),
        })
      : await readFile(downloaded.filePath);
    const trimElapsedMs = Date.now() - trimStartedAt;
    const preparedExtension = shouldClipForProcessing ? "flac" : downloaded.fileExtension;
    const preparedContentType = shouldClipForProcessing ? "audio/flac" : downloaded.contentType;
    const preparedFileName = buildImportedProcessingFileName(preparedExtension);

    await input.onUploadStart?.();
    const sourceR2Key = buildImportedSourceKey(
      input.ownerId,
      input.publicId,
      preparedExtension
    );

    const uploadStartedAt = Date.now();
    await uploadToR2(preparedAudioBuffer, sourceR2Key, preparedContentType);
    const uploadElapsedMs = Date.now() - uploadStartedAt;

    let uploadedFileSize = preparedAudioBuffer.byteLength;
    if (!shouldClipForProcessing) {
      uploadedFileSize = detectedFileSizeBytes;
    }

    console.info("[Transcriptions][Link Import] Source media uploaded", {
      publicId: input.publicId,
      clipFirstApplied: shouldClipForProcessing,
      previewTitle: input.previewTitle ?? null,
      downloadedTitle: downloaded.title,
      finalTitle,
      titleSource,
      previewDurationMs: input.previewDurationMs ?? null,
      downloadedDurationMs: downloaded.durationMs,
      probedDurationMs,
      originalDurationMs: effectiveDurationMs,
      uploadedDurationMs: shouldClipForProcessing
        ? Math.round(Number(input.maxDurationSeconds) * 1000)
        : effectiveDurationMs,
      uploadedFileName: preparedFileName,
      uploadedFileExtension: preparedExtension,
      uploadedContentType: preparedContentType,
      uploadedFileSizeBytes: uploadedFileSize,
      uploadedSourceKey: sourceR2Key,
      downloadElapsedMs,
      probeElapsedMs,
      trimElapsedMs,
      uploadElapsedMs,
      totalImportElapsedMs: Date.now() - importStartedAt,
    });

    return {
      mode: "r2_imported",
      sourceType: downloaded.sourceType,
      fileName: preparedFileName,
      fileExtension: preparedExtension,
      contentType: preparedContentType,
      fileSizeBytes: uploadedFileSize,
      sourceR2Key,
      sourceUrl: "",
      preview: downloaded.preview,
      durationMs: effectiveDurationMs,
      title: finalTitle,
      titleSource,
      clippedForProcessing: shouldClipForProcessing,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
