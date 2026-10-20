import { probeMediaUrlForTranscription } from "@markless/server/src/lib/ffmpeg/video-utils";
import { getPresignedDownloadUrl } from "@markless/server/src/lib/storage/r2-storage";

const BILLING_MEDIA_URL_EXPIRES_IN_SECONDS = 15 * 60;

export type VerifiedBillableMedia = {
  durationMs: number;
  formatNames: string[];
  audioCodec: string | null;
  hasVideo: boolean;
};

export class BillableMediaVerificationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BillableMediaVerificationError";
  }
}

/**
 * Obtains billing metadata from the uploaded object itself. The signed URL lets
 * ffprobe read the remote R2 object without first downloading it to the API host.
 */
export async function verifyBillableMediaFromR2(input: {
  sourceKey: string;
  contentType: string;
}): Promise<VerifiedBillableMedia> {
  try {
    const mediaUrl = await getPresignedDownloadUrl(input.sourceKey, {
      contentType: input.contentType,
      expiresIn: BILLING_MEDIA_URL_EXPIRES_IN_SECONDS,
    });
    const probe = await probeMediaUrlForTranscription(mediaUrl);

    if (!probe.hasAudio) {
      throw new BillableMediaVerificationError("The uploaded media does not contain a readable audio track");
    }
    if (probe.durationMs === null || probe.durationMs <= 0) {
      throw new BillableMediaVerificationError("The uploaded media duration could not be determined");
    }

    return {
      durationMs: probe.durationMs,
      formatNames: probe.formatNames,
      audioCodec: probe.audioCodec,
      hasVideo: probe.hasVideo,
    };
  } catch (error) {
    if (error instanceof BillableMediaVerificationError) {
      throw error;
    }

    throw new BillableMediaVerificationError(
      "The uploaded media could not be verified",
      { cause: error }
    );
  }
}
