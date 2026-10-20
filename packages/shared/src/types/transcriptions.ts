export type TranscriptionSourceType = "audio" | "video";
export type TranscriptionAiSummaryTemplateKey = "off" | "general";
export type TranscriptionAiMindMapTemplateKey = "off" | "general";
export type TranscriptionAiArtifactStatus = "processing" | "completed" | "failed";
export type TranscriptionAiArtifactType = "summary" | "mind_map";
export type TranscriptionTranslationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";
export type TranscriptionTranscriptSource =
  | "ai_transcription"
  | "youtube_manual_captions"
  | "youtube_auto_captions";
export type TranscriptionShareVisibility = "private" | "public_link";

export type TranscriptionStatus =
  | "queued"
  | "preprocessing"
  | "transcribing"
  | "succeeded"
  | "failed";

export type TranscriptionStage =
  | "queued"
  | "importing_media"
  | "uploading_source"
  | "extracting_audio"
  | "audio_extracted"
  | "submitting_model"
  | "waiting_result"
  | "completed"
  | "failed";

export interface TranscriptionWord {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string | null;
  probability?: number | null;
}

export interface TranscriptionSegment {
  id: string;
  speaker: string | null;
  rawSpeaker?: string | null;
  startMs: number;
  endMs: number;
  text: string;
  avgLogprob?: number | null;
  words?: TranscriptionWord[];
  sourceStartIndex?: number;
  sourceEndIndex?: number;
}

export type TranscriptionSpeakerColorToken =
  | "slate"
  | "blue"
  | "emerald"
  | "amber"
  | "pink"
  | "violet"
  | "cyan"
  | "orange"
  | "indigo";

export interface TranscriptionSpeakerClientData {
  id: string;
  key: string;
  defaultLabel: string;
  displayName: string | null;
  colorToken: TranscriptionSpeakerColorToken;
  orderIndex: number;
  isUnknown: boolean;
}

export interface TranscriptionDisplaySegment {
  id: string;
  speakerId: string | null;
  speakerKey: string | null;
  speakerLabel: string | null;
  speakerColorToken: TranscriptionSpeakerColorToken;
  isUnknownSpeaker: boolean;
  orderIndex: number;
  sourceStartIndex: number;
  sourceEndIndex: number;
  startMs: number;
  endMs: number;
  text: string;
  textOriginal: string;
  speakerLabelOverride?: string | null;
  isEdited: boolean;
}

export interface TranscriptionAiSummaryItem {
  id: string;
  text: string;
}

export interface TranscriptionAiSummaryData {
  overview: string;
  keyPoints: TranscriptionAiSummaryItem[];
  takeaways: TranscriptionAiSummaryItem[];
}

export interface TranscriptionMindMapNode {
  id: string;
  label: string;
  type: "root" | "branch" | "leaf";
  startSegmentOrder: number | null;
  endSegmentOrder: number | null;
  startMs: number | null;
  endMs: number | null;
  children: TranscriptionMindMapNode[];
}

export interface TranscriptionMindMapData {
  root: TranscriptionMindMapNode;
}

export interface TranscriptionAiArtifactClientData {
  artifactType: TranscriptionAiArtifactType;
  templateKey: Extract<TranscriptionAiSummaryTemplateKey, "general">;
  status: TranscriptionAiArtifactStatus;
  sourceDisplayVersion: number;
  summary: TranscriptionAiSummaryData | null;
  mindMap: TranscriptionMindMapData | null;
  errorMessage: string | null;
  generatedAt: string | null;
  updatedAt: string;
  isStale: boolean;
}

export interface TranscriptionAiArtifactCollectionClientData {
  summary: TranscriptionAiArtifactClientData | null;
  mind_map: TranscriptionAiArtifactClientData | null;
}

export interface TranscriptionTranslationSegmentClientData {
  sourceSegmentId: string;
  orderIndex: number;
  textTranslated: string;
}

export interface TranscriptionTranslationClientData {
  targetLanguage: string;
  sourceLanguage: string | null;
  status: TranscriptionTranslationStatus;
  sourceDisplayVersion: number;
  provider: string;
  model: string;
  errorMessage: string | null;
  generatedAt: string | null;
  updatedAt: string;
  isStale: boolean;
  segments: TranscriptionTranslationSegmentClientData[] | null;
}

export type TranscriptionTranslationCollectionClientData = Record<
  string,
  TranscriptionTranslationClientData
>;

export interface TranscriptionJobClientData {
  id: string;
  publicId: string;
  status: TranscriptionStatus;
  stage: TranscriptionStage;
  statusMessage: string | null;
  sourceType: TranscriptionSourceType;
  fileName: string;
  displayTitle: string | null;
  transcriptSource: TranscriptionTranscriptSource | null;
  contentType: string;
  fileSize: number;
  sourceDurationMs: number | null;
  processedDurationMs: number | null;
  durationLimitMs: number | null;
  wasDurationTrimmed: boolean;
  summaryTemplateKey: TranscriptionAiSummaryTemplateKey;
  mindMapTemplateKey: TranscriptionAiMindMapTemplateKey;
  language: string | null;
  speakerCount: number | null;
  durationMs: number | null;
  displayVersion: number;
  fullText: string | null;
  displayFullText: string | null;
  speakers: TranscriptionSpeakerClientData[];
  segments: TranscriptionDisplaySegment[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TranscriptionReadResponse {
  task: TranscriptionJobClientData;
  streamToken: string | null;
  aiArtifacts: TranscriptionAiArtifactCollectionClientData;
  translations: TranscriptionTranslationCollectionClientData;
}

export interface TranscriptionShareClientData {
  enabled: boolean;
  visibility: TranscriptionShareVisibility;
  shareUrl: string | null;
  allowCopy: boolean;
  allowAudioPlayback: boolean;
  viewCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  lastAccessedAt: string | null;
  expiresAt: string | null;
}

export interface PublicTranscriptionShareReadResponse {
  share: Pick<
    TranscriptionShareClientData,
    "allowCopy" | "allowAudioPlayback" | "expiresAt"
  >;
  task: TranscriptionJobClientData;
  aiArtifacts: TranscriptionAiArtifactCollectionClientData;
  translations: TranscriptionTranslationCollectionClientData;
  playbackUrl: string | null;
}
