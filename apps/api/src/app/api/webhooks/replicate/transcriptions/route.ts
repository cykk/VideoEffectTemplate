import { after, NextRequest } from "next/server";
import { successResponse, errorResponse } from "@markless/shared/src/lib/api/response";
import { verifyReplicateWebhookSignature } from "@markless/server/src/lib/replicate/webhook";
import { verifyTranscriptionWebhookToken } from "@markless/shared/src/lib/transcriptions/tokens";
import {
  archiveTranscriptionRawOutput,
  completeTranscriptionJobFromReplicate,
} from "@markless/server/src/lib/transcriptions/service";
import { generateEnabledTranscriptionArtifacts } from "@markless/server/src/lib/transcriptions/ai-artifacts";
import { getEnv } from "@markless/shared/src/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReplicateWebhookPayload = {
  id: string;
  status: string;
  version?: string;
  output?: unknown;
  error?: string | null;
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const secret = getEnv("REPLICATE_WEBHOOK_SECRET");
  if (!secret) {
    return errorResponse("INTERNAL_ERROR", "Missing Replicate webhook secret", 500);
  }

  const signature = verifyReplicateWebhookSignature(request.headers, body, secret);
  if (!signature.valid) {
    return errorResponse("FORBIDDEN", "Invalid webhook signature", 403, signature.reason);
  }

  const token = request.nextUrl.searchParams.get("token");
  const tokenVerification = verifyTranscriptionWebhookToken(token);
  if (!tokenVerification.valid || !tokenVerification.payload?.publicId) {
    return errorResponse("FORBIDDEN", "Invalid webhook token", 403);
  }

  let payload: ReplicateWebhookPayload;
  try {
    payload = JSON.parse(body) as ReplicateWebhookPayload;
  } catch {
    return errorResponse("INVALID_PARAMS", "Invalid webhook payload", 400);
  }

  console.info("[Replicate Webhook] Received transcription callback", {
    publicId: tokenVerification.payload.publicId,
    predictionId: payload.id,
    status: payload.status,
  });

  const completedJob = await completeTranscriptionJobFromReplicate(
    tokenVerification.payload.publicId,
    payload
  );

  after(async () => {
    if (completedJob) {
      await generateEnabledTranscriptionArtifacts(completedJob);
    }
    await archiveTranscriptionRawOutput(
      tokenVerification.payload.publicId,
      payload.id,
      payload.output
    );
  });

  return successResponse({
    ok: true,
  });
}
