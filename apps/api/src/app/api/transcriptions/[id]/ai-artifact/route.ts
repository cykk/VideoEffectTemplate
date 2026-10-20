import { after, NextRequest } from "next/server";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@markless/shared/src/lib/api/response";
import { authorizeTranscriptionRead } from "@markless/server/src/lib/transcriptions/access";
import {
  generateTranscriptionAiArtifact,
  setTranscriptionMindMapTemplateKey,
  setTranscriptionSummaryTemplateKey,
  serializeTranscriptionAiArtifacts,
} from "@markless/server/src/lib/transcriptions/ai-artifacts";
import { getTranscriptionJobByPublicId } from "@markless/server/src/lib/transcriptions/service";
import type { TranscriptionAiArtifactType } from "@markless/shared/src/types/transcriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateAiArtifactRequest = {
  artifactType?: TranscriptionAiArtifactType;
  templateKey?: "off" | "general";
  force?: boolean;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeTranscriptionRead(request, id);

  if ("reason" in access) {
    return errorResponse(
      access.reason === "not_found" ? "INVALID_PARAMS" : "FORBIDDEN",
      access.reason === "not_found" ? "Transcription not found" : "Access denied",
      access.reason === "not_found" ? 404 : 403
    );
  }

  const body = (await request.json().catch(() => ({}))) as UpdateAiArtifactRequest;
  const artifactType = String(body.artifactType || "").trim() as TranscriptionAiArtifactType;
  const templateKey = String(body.templateKey || "").trim();
  const force = Boolean(body.force);

  if (artifactType !== "summary" && artifactType !== "mind_map") {
    return validationErrorResponse("artifactType is invalid");
  }

  if (artifactType === "summary") {
    if (templateKey !== "off" && templateKey !== "general") {
      return validationErrorResponse("templateKey is invalid");
    }
  } else if (templateKey !== "general") {
    return validationErrorResponse("templateKey is invalid");
  }

  const isAlreadyEnabled =
    artifactType === "summary"
      ? access.job.summaryTemplateKey === templateKey
      : access.job.mindMapTemplateKey === "general";

  const existingArtifacts = await serializeTranscriptionAiArtifacts(
    access.job.id,
    access.job.displayVersion
  );
  const existingArtifact = existingArtifacts[artifactType];

  if (
    isAlreadyEnabled &&
    !force &&
    existingArtifact &&
    existingArtifact.status === "completed" &&
    !existingArtifact.isStale
  ) {
    return successResponse({
      artifactType,
      templateKey,
      queued: false,
      aiArtifacts: existingArtifacts,
    });
  }

  if (artifactType === "summary" && templateKey === "off") {
    const updatedJob = await setTranscriptionSummaryTemplateKey(access.job.publicId, "off");
    if (!updatedJob) {
      return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
    }

    return successResponse({
      artifactType,
      templateKey,
      queued: false,
      aiArtifacts:
        updatedJob.id === access.job.id &&
        updatedJob.displayVersion === access.job.displayVersion
          ? existingArtifacts
          : await serializeTranscriptionAiArtifacts(updatedJob.id, updatedJob.displayVersion),
    });
  }

  const updatedJob =
    artifactType === "summary"
      ? await setTranscriptionSummaryTemplateKey(access.job.publicId, "general")
      : await setTranscriptionMindMapTemplateKey(access.job.publicId, "general");
  if (!updatedJob) {
    return errorResponse("INVALID_PARAMS", "Transcription not found", 404);
  }

  if (updatedJob.status !== "succeeded" || updatedJob.stage !== "completed") {
    return successResponse({
      artifactType,
      templateKey,
      queued: false,
      aiArtifacts: await serializeTranscriptionAiArtifacts(
        updatedJob.id,
        updatedJob.displayVersion
      ),
    });
  }

  const currentArtifacts =
    updatedJob.id === access.job.id &&
    updatedJob.displayVersion === access.job.displayVersion &&
    isAlreadyEnabled
      ? existingArtifacts
      : await serializeTranscriptionAiArtifacts(updatedJob.id, updatedJob.displayVersion);
  const currentArtifact = currentArtifacts[artifactType];

  if (
    !force &&
    currentArtifact &&
    currentArtifact.status === "completed" &&
    !currentArtifact.isStale
  ) {
    return successResponse({
      artifactType,
      templateKey,
      queued: false,
      aiArtifacts: currentArtifacts,
    });
  }

  after(async () => {
    const latestJob = await getTranscriptionJobByPublicId(updatedJob.publicId);
    if (!latestJob) {
      return;
    }
    await generateTranscriptionAiArtifact(latestJob, artifactType, { force });
  });

  return successResponse({
    artifactType,
    templateKey,
    queued: true,
    aiArtifacts: currentArtifacts,
  });
}
