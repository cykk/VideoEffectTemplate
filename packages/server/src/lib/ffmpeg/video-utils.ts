import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

export type TranscriptionMediaProbe = {
  hasAudio: boolean;
  hasVideo: boolean;
  audioCodec: string | null;
  formatNames: string[];
  durationMs: number | null;
};

/**
 * Reads authoritative stream and duration metadata from a local path or a signed media URL.
 */
export async function probeTranscriptionMedia(
  inputPath: string
): Promise<TranscriptionMediaProbe> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=format_name,duration",
      "-show_entries",
      "stream=codec_type,codec_name",
      "-of",
      "json",
      inputPath,
    ],
    { timeout: 60000 }
  );
  const metadata = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string }>;
  };
  const audioStream = metadata.streams?.find((stream) => stream.codec_type === "audio");
  const durationSeconds = Number(metadata.format?.duration);

  return {
    hasAudio: Boolean(audioStream),
    hasVideo: Boolean(metadata.streams?.some((stream) => stream.codec_type === "video")),
    audioCodec: audioStream?.codec_name ?? null,
    formatNames: (metadata.format?.format_name ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    durationMs:
      Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.round(durationSeconds * 1000)
        : null,
  };
}

export async function probeMediaUrlForTranscription(
  mediaUrl: string
): Promise<TranscriptionMediaProbe> {
  return probeTranscriptionMedia(mediaUrl);
}

export async function probeMediaBufferForTranscription(
  mediaBuffer: Buffer,
  inputExtension: string
): Promise<TranscriptionMediaProbe> {
  const normalizedExtension = inputExtension.replace(/^\./, "").toLowerCase() || "bin";
  const tempDir = await mkdtemp(join(tmpdir(), "transcription-probe-"));
  const inputPath = join(tempDir, `input.${normalizedExtension}`);

  try {
    await writeFile(inputPath, mediaBuffer);
    return await probeTranscriptionMedia(inputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function prepareAudioBufferForTranscription(input: {
  mediaBuffer: Buffer;
  inputExtension: string;
  maxDurationSeconds?: number;
}): Promise<Buffer> {
  const normalizedExtension = input.inputExtension.replace(/^\./, "").toLowerCase() || "bin";
  const tempDir = await mkdtemp(join(tmpdir(), "transcription-flac-"));
  const inputPath = join(tempDir, `input.${normalizedExtension}`);
  const outputPath = join(tempDir, "audio.flac");

  try {
    await writeFile(inputPath, input.mediaBuffer);
    const args = [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0",
      "-vn",
      "-sn",
      "-dn",
    ];

    if (Number.isFinite(input.maxDurationSeconds) && input.maxDurationSeconds! > 0) {
      args.push("-t", input.maxDurationSeconds!.toFixed(3));
    }

    args.push(
      "-ac",
      "1",
      "-ar",
      "16000",
      "-sample_fmt",
      "s16",
      "-c:a",
      "flac",
      outputPath
    );
    await execFileAsync("ffmpeg", args, { timeout: 180000 });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function prepareAudioFileForTranscription(input: {
  inputPath: string;
  maxDurationSeconds?: number;
}): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "transcription-file-flac-"));
  const outputPath = join(tempDir, "audio.flac");

  try {
    const args = [
      "-y",
      "-i",
      input.inputPath,
      "-map",
      "0:a:0",
      "-vn",
      "-sn",
      "-dn",
    ];

    if (Number.isFinite(input.maxDurationSeconds) && input.maxDurationSeconds! > 0) {
      args.push("-t", input.maxDurationSeconds!.toFixed(3));
    }

    args.push(
      "-ac",
      "1",
      "-ar",
      "16000",
      "-sample_fmt",
      "s16",
      "-c:a",
      "flac",
      outputPath
    );
    await execFileAsync("ffmpeg", args, { timeout: 180000 });
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function probeMediaFileDurationMs(inputPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        inputPath,
      ],
      { timeout: 30000 }
    );

    const durationSeconds = parseFloat(stdout.trim());
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return null;
    }

    return Math.round(durationSeconds * 1000);
  } catch {
    return null;
  }
}

/**
 * Get the duration of a video file in seconds.
 * Reads from the buffer by writing to a temp file first.
 */
export async function getVideoDuration(videoBuffer: Buffer): Promise<number> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-"));
  const tempPath = join(tempDir, "input.mp4");

  try {
    await writeFile(tempPath, videoBuffer);

    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      tempPath,
    ], { timeout: 30000 });

    const duration = parseFloat(stdout.trim());
    if (isNaN(duration) || duration <= 0) {
      throw new Error("Could not determine video duration");
    }
    return duration;
  } finally {
    await unlink(tempPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getVideoMetadata(videoBuffer: Buffer): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-meta-"));
  const tempPath = join(tempDir, "input.mp4");

  try {
    await writeFile(tempPath, videoBuffer);

    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,avg_frame_rate,r_frame_rate",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        tempPath,
      ],
      { timeout: 30000 }
    );

    const json = JSON.parse(stdout);
    const stream = json.streams?.[0] ?? {};
    const format = json.format ?? {};

    const duration = parseFloat(format.duration);
    const width = Number(stream.width);
    const height = Number(stream.height);
    const fpsStr = stream.avg_frame_rate || stream.r_frame_rate || "25/1";
    const [num, den] = String(fpsStr)
      .split("/")
      .map((value: string) => Number(value));
    const fps = den ? num / den : Number(num);

    if (!Number.isFinite(duration) || duration <= 0 || !width || !height) {
      throw new Error("Invalid video metadata");
    }

    return {
      duration,
      width,
      height,
      fps: Number.isFinite(fps) && fps > 0 ? fps : 25,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Get the duration of a video from a URL by downloading it to a temp file.
 */
export async function getVideoDurationFromUrl(videoUrl: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    videoUrl,
  ], { timeout: 60000 });

  const duration = parseFloat(stdout.trim());
  if (isNaN(duration) || duration <= 0) {
    throw new Error("Could not determine video duration");
  }
  return duration;
}

/**
 * Generate a mask video from a static mask PNG image.
 * The mask image is looped for the given duration.
 * Returns the mask video as a Buffer.
 */
export async function generateMaskVideo(
  maskPngBuffer: Buffer,
  durationSeconds: number,
  fps = 25
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-mask-"));
  const maskInputPath = join(tempDir, "mask.png");
  const maskOutputPath = join(tempDir, "mask_video.mp4");

  try {
    await writeFile(maskInputPath, maskPngBuffer);

    const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 25;

    const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 1;

    await execFileAsync("ffmpeg", [
      "-y",
      "-loop", "1",
      "-i", maskInputPath,
      "-r", safeFps.toFixed(3),
      "-c:v", "libx264",
      "-t", safeDuration.toFixed(3),
      "-pix_fmt", "yuv420p",
      "-an",
      maskOutputPath,
    ], { timeout: 120000 });

    const resultBuffer = await readFile(maskOutputPath);
    return resultBuffer;
  } finally {
    await unlink(maskInputPath).catch(() => {});
    await unlink(maskOutputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Scale a video buffer to target dimensions.
 * Outputs an MP4 (H.264) buffer without audio.
 */
export async function scaleVideoBuffer(
  videoBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  targetFps?: number
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-scale-"));
  const inputPath = join(tempDir, "input.mp4");
  const outputPath = join(tempDir, "scaled.mp4");

  try {
    await writeFile(inputPath, videoBuffer);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=${targetWidth}:${targetHeight}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-an",
    ];

    if (Number.isFinite(targetFps) && (targetFps as number) > 0) {
      args.push("-r", String(targetFps));
    }

    args.push(outputPath);

    await execFileAsync("ffmpeg", args, { timeout: 180000 });

    return Buffer.from(await readFile(outputPath));
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract audio from a video buffer as M4A (AAC).
 */
export async function extractAudioBuffer(videoBuffer: Buffer): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-audio-"));
  const inputPath = join(tempDir, "input.mp4");
  const outputPath = join(tempDir, "audio.m4a");

  try {
    await writeFile(inputPath, videoBuffer);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ac",
        "2",
        outputPath,
      ],
      { timeout: 120000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract a transcription-friendly AAC/M4A audio track from a video buffer.
 * Uses mono 16k AAC so downstream ASR models receive a compact and stable input format.
 */
export async function extractAudioBufferForTranscription(
  videoBuffer: Buffer
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-audio-transcribe-"));
  const inputPath = join(tempDir, "input.mp4");
  const outputPath = join(tempDir, "audio.m4a");

  try {
    await writeFile(inputPath, videoBuffer);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract a transcription-friendly AAC/M4A audio track from a video buffer.
 * When maxDurationSeconds is provided, only the first part of the media is processed.
 */
export async function extractAudioBufferForTranscriptionClip(
  videoBuffer: Buffer,
  maxDurationSeconds?: number
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-audio-transcribe-clip-"));
  const inputPath = join(tempDir, "input.mp4");
  const outputPath = join(tempDir, "audio.m4a");

  try {
    await writeFile(inputPath, videoBuffer);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
    ];

    if (Number.isFinite(maxDurationSeconds) && (maxDurationSeconds as number) > 0) {
      args.push("-t", Number(maxDurationSeconds).toFixed(3));
    }

    args.push(outputPath);

    await execFileAsync("ffmpeg", args, { timeout: 180000 });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Trim an audio buffer to the first maxDurationSeconds and transcode it into mono 16k AAC/M4A.
 * This is used for free transcription limits so the uploaded source can be longer than
 * the actual audio sent to the ASR model.
 */
export async function trimAudioBufferForTranscription(
  audioBuffer: Buffer,
  inputExtension: string,
  maxDurationSeconds: number
): Promise<Buffer> {
  const normalizedExtension = inputExtension.replace(/^\./, "").toLowerCase() || "bin";
  const tempDir = await mkdtemp(join(tmpdir(), "wm-audio-trim-"));
  const inputPath = join(tempDir, `input.${normalizedExtension}`);
  const outputPath = join(tempDir, "audio.m4a");

  try {
    await writeFile(inputPath, audioBuffer);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-t",
        Number(maxDurationSeconds).toFixed(3),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function trimAudioFileForTranscription(
  inputPath: string,
  maxDurationSeconds: number
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-audio-trim-file-"));
  const outputPath = join(tempDir, "audio.m4a");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-t",
        Number(maxDurationSeconds).toFixed(3),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Merge a video and audio buffer into a single MP4 (H.264 + AAC).
 */
export async function mergeVideoAudioBuffers(
  videoBuffer: Buffer,
  audioBuffer: Buffer
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-merge-"));
  const videoPath = join(tempDir, "video.mp4");
  const audioPath = join(tempDir, "audio.m4a");
  const outputPath = join(tempDir, "merged.mp4");

  try {
    await writeFile(videoPath, videoBuffer);
    await writeFile(audioPath, audioBuffer);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract the first frame from a video buffer as a PNG image.
 * Returns the frame as a Buffer.
 */
export async function extractFirstFrame(videoBuffer: Buffer): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-frame-"));
  const videoPath = join(tempDir, "input.mp4");
  const framePath = join(tempDir, "frame.png");

  try {
    await writeFile(videoPath, videoBuffer);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-vframes", "1",
      "-f", "image2",
      framePath,
    ], { timeout: 30000 });

    const frameBuffer = await readFile(framePath);
    return frameBuffer;
  } finally {
    await unlink(videoPath).catch(() => {});
    await unlink(framePath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Extract a thumbnail from a video buffer as a JPEG image.
 * Scales to target width while keeping aspect ratio (height will be even).
 */
export async function extractVideoThumbnail(
  videoBuffer: Buffer,
  targetWidth: number = 320
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-thumb-"));
  const videoPath = join(tempDir, "input.mp4");
  const framePath = join(tempDir, "thumb.jpg");

  const safeWidth = Number.isFinite(targetWidth) && targetWidth > 0 ? Math.round(targetWidth) : 320;

  try {
    await writeFile(videoPath, videoBuffer);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-vf",
      `scale=${safeWidth}:-2`,
      "-q:v",
      "3",
      framePath,
    ], { timeout: 30000 });

    const frameBuffer = await readFile(framePath);
    return frameBuffer;
  } finally {
    await unlink(videoPath).catch(() => {});
    await unlink(framePath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Crop a video buffer to the given rectangle.
 * Outputs an MP4 (H.264) buffer without audio.
 */
export async function cropVideoBuffer(
  videoBuffer: Buffer,
  crop: { x: number; y: number; width: number; height: number },
  targetFps?: number
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-crop-"));
  const inputPath = join(tempDir, "input.mp4");
  const outputPath = join(tempDir, "cropped.mp4");

  const x = Math.max(0, Math.round(crop.x));
  const y = Math.max(0, Math.round(crop.y));
  let w = Math.max(2, Math.round(crop.width));
  let h = Math.max(2, Math.round(crop.height));

  if (w % 2 !== 0) w -= 1;
  if (h % 2 !== 0) h -= 1;
  if (w < 2) w = 2;
  if (h < 2) h = 2;

  try {
    await writeFile(inputPath, videoBuffer);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `crop=${w}:${h}:${x}:${y}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-an",
    ];

    if (Number.isFinite(targetFps) && (targetFps as number) > 0) {
      args.push("-r", String(targetFps));
    }

    args.push(outputPath);

    await execFileAsync("ffmpeg", args, { timeout: 180000 });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Overlay a video buffer on top of a base video buffer at the given position.
 * Outputs an MP4 (H.264) buffer without audio.
 */
export async function overlayVideoBuffer(
  baseVideoBuffer: Buffer,
  overlayVideoBufferInput: Buffer,
  x: number,
  y: number
): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-overlay-"));
  const basePath = join(tempDir, "base.mp4");
  const overlayPath = join(tempDir, "overlay.mp4");
  const outputPath = join(tempDir, "overlayed.mp4");

  const ox = Math.max(0, Math.round(x));
  const oy = Math.max(0, Math.round(y));

  try {
    await Promise.all([
      writeFile(basePath, baseVideoBuffer),
      writeFile(overlayPath, overlayVideoBufferInput),
    ]);

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        basePath,
        "-i",
        overlayPath,
        "-filter_complex",
        `[0:v][1:v]overlay=${ox}:${oy}:shortest=1`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-an",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(basePath).catch(() => {});
    await unlink(overlayPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Overlay a video buffer onto a base video buffer using a mask with feathered edges.
 * The mask should be a PNG buffer (white = overlay, black = keep base).
 */
export async function overlayVideoBufferWithMask(options: {
  baseVideoBuffer: Buffer;
  overlayVideoBuffer: Buffer;
  maskBuffer: Buffer;
  x: number;
  y: number;
  width: number;
  height: number;
  featherPx?: number;
}): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "wm-overlay-mask-"));
  const basePath = join(tempDir, "base.mp4");
  const overlayPath = join(tempDir, "overlay.mp4");
  const maskPath = join(tempDir, "mask.png");
  const outputPath = join(tempDir, "overlayed.mp4");

  let targetWidth = Math.max(2, Math.round(options.width));
  let targetHeight = Math.max(2, Math.round(options.height));
  if (targetWidth % 2 !== 0) targetWidth -= 1;
  if (targetHeight % 2 !== 0) targetHeight -= 1;
  if (targetWidth < 2) targetWidth = 2;
  if (targetHeight < 2) targetHeight = 2;

  const ox = Math.max(0, Math.round(options.x));
  const oy = Math.max(0, Math.round(options.y));
  const feather = Number.isFinite(options.featherPx) ? Math.max(0, Math.round(options.featherPx as number)) : 0;

  try {
    await Promise.all([
      writeFile(basePath, options.baseVideoBuffer),
      writeFile(overlayPath, options.overlayVideoBuffer),
      writeFile(maskPath, options.maskBuffer),
    ]);

    const blurFilter = feather > 0 ? `,boxblur=${feather}:1` : "";

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        basePath,
        "-i",
        overlayPath,
        "-loop",
        "1",
        "-i",
        maskPath,
        "-filter_complex",
        `[2:v]format=gray,scale=${targetWidth}:${targetHeight}${blurFilter}[alpha];` +
          `[1:v][alpha]alphamerge[ovr];` +
          `[0:v][ovr]overlay=${ox}:${oy}:shortest=1`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-an",
        outputPath,
      ],
      { timeout: 180000 }
    );

    return await readFile(outputPath);
  } finally {
    await unlink(basePath).catch(() => {});
    await unlink(overlayPath).catch(() => {});
    await unlink(maskPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
