import { asc, eq } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import {
  transcriptionDisplaySegments,
  transcriptionSpeakers,
  type TranscriptionJob,
} from "@markless/server/src/lib/db/schema/transcriptions";
import {
  configurePdfExportFont,
  getPreferredDocumentFontFamily,
  setPdfExportFont,
} from "@markless/shared/src/lib/transcriptions/export-fonts";
import type { TranscriptionSpeakerClientData } from "@markless/shared/src/types/transcriptions";
import { coerceTranscriptionSegments } from "@markless/shared/src/lib/transcriptions/segment-aggregation";
import {
  buildSubtitleCues,
  buildWordSubtitleCues,
  normalizeSubtitleCues,
  normalizeSubtitleLayoutOptions,
  renderSrt,
  renderVtt,
  type SubtitleLayoutOptions,
} from "@markless/server/src/lib/transcriptions/subtitle-export";

export type TranscriptionExportFormat = "txt" | "docx" | "pdf" | "csv" | "srt" | "vtt";

export type TranscriptionExportOptions = {
  format: TranscriptionExportFormat;
  showSpeakerNames: boolean;
  showTimestamps: boolean;
  subtitleLayout?: SubtitleLayoutOptions;
};

type ExportSegment = {
  startMs: number;
  endMs: number;
  speakerId?: string | null;
  speaker: string | null;
  text: string;
  isEdited?: boolean;
  sourceStartIndex?: number;
  sourceEndIndex?: number;
};

type LoadedExportData = {
  fileNameBase: string;
  displayFullText: string | null;
  segments: ExportSegment[];
};

type ReadableExportBlock = {
  labelLine: string | null;
  bodyText: string;
};

type BuiltExportFile = {
  contentType: string;
  fileName: string;
  buffer: Buffer;
};

function shouldUsePlainTxtFastPath(options: TranscriptionExportOptions): boolean {
  return (
    options.format === "txt" &&
    !options.showSpeakerNames &&
    !options.showTimestamps
  );
}

function formatTimestamp(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || "transcript";
}

function buildExportFileName(
  fileNameBase: string,
  extension: TranscriptionExportFormat
): string {
  return `${fileNameBase}.${extension}`;
}

function buildPlainTxtFileFromJob(job: TranscriptionJob): BuiltExportFile | null {
  const content = job.displayFullText?.trim();
  if (!content) {
    return null;
  }

  return {
    contentType: "text/plain; charset=utf-8",
    fileName: buildExportFileName(stripFileExtension(job.sourceFileName), "txt"),
    buffer: Buffer.from(content, "utf8"),
  };
}

async function loadTxtSegmentsWithTimestamps(job: TranscriptionJob): Promise<LoadedExportData> {
  const segmentRows = await db
    .select({
      startMs: transcriptionDisplaySegments.startMs,
      endMs: transcriptionDisplaySegments.endMs,
      text: transcriptionDisplaySegments.textCurrent,
    })
    .from(transcriptionDisplaySegments)
    .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id))
    .orderBy(asc(transcriptionDisplaySegments.orderIndex));

  return {
    fileNameBase: stripFileExtension(job.sourceFileName),
    displayFullText: job.displayFullText ?? null,
    segments: segmentRows.map((segment) => ({
      startMs: segment.startMs,
      endMs: segment.endMs,
      speaker: null,
      text: segment.text,
    })),
  };
}

async function loadTxtSegmentsWithLabels(
  job: TranscriptionJob,
  includeTimestamps: boolean
): Promise<LoadedExportData> {
  const [speakerRows, segmentRows] = await Promise.all([
    db
      .select({
        id: transcriptionSpeakers.id,
        defaultLabel: transcriptionSpeakers.defaultLabel,
        displayName: transcriptionSpeakers.displayName,
      })
      .from(transcriptionSpeakers)
      .where(eq(transcriptionSpeakers.transcriptionJobId, job.id))
      .orderBy(asc(transcriptionSpeakers.orderIndex)),
    db
      .select({
        speakerId: transcriptionDisplaySegments.speakerId,
        speakerLabelOverride: transcriptionDisplaySegments.speakerLabelOverride,
        startMs: transcriptionDisplaySegments.startMs,
        endMs: transcriptionDisplaySegments.endMs,
        text: transcriptionDisplaySegments.textCurrent,
      })
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id))
      .orderBy(asc(transcriptionDisplaySegments.orderIndex)),
  ]);

  const speakerMap = new Map(
    speakerRows.map((speaker) => [
      speaker.id,
      speaker.displayName ?? speaker.defaultLabel,
    ])
  );

  return {
    fileNameBase: stripFileExtension(job.sourceFileName),
    displayFullText: job.displayFullText ?? null,
    segments: segmentRows.map((segment) => ({
      startMs: includeTimestamps ? segment.startMs : 0,
      endMs: includeTimestamps ? segment.endMs : 0,
      speaker:
        segment.speakerLabelOverride?.trim() ||
        speakerMap.get(segment.speakerId) ||
        null,
      text: segment.text,
    })),
  };
}

function buildReadableExportBlocks(
  segments: ExportSegment[],
  options: Pick<TranscriptionExportOptions, "showSpeakerNames" | "showTimestamps">
): ReadableExportBlock[] {
  return segments.map((segment) => {
    const labelParts: string[] = [];

    if (options.showSpeakerNames && segment.speaker) {
      labelParts.push(segment.speaker);
    }

    if (options.showTimestamps) {
      labelParts.push(`[${formatTimestamp(segment.startMs)}]`);
    }

    return {
      labelLine: labelParts.length > 0 ? labelParts.join(" ") : null,
      bodyText: segment.text,
    };
  });
}

function renderReadableBlocksAsPlainText(blocks: ReadableExportBlock[]): string {
  return blocks
    .map((block) => (block.labelLine ? `${block.labelLine}\n${block.bodyText}` : block.bodyText))
    .filter(Boolean)
    .join("\n\n");
}

async function loadExportData(job: TranscriptionJob): Promise<LoadedExportData> {
  const [speakerRows, segmentRows] = await Promise.all([
    db
      .select()
      .from(transcriptionSpeakers)
      .where(eq(transcriptionSpeakers.transcriptionJobId, job.id))
      .orderBy(asc(transcriptionSpeakers.orderIndex)),
    db
      .select()
      .from(transcriptionDisplaySegments)
      .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id))
      .orderBy(asc(transcriptionDisplaySegments.orderIndex)),
  ]);

  const speakerMap = new Map<string, TranscriptionSpeakerClientData>(
    speakerRows.map((speaker) => [
      speaker.id,
      {
        id: speaker.id,
        key: speaker.speakerKey,
        defaultLabel: speaker.defaultLabel,
        displayName: speaker.displayName ?? null,
        colorToken: speaker.colorToken as TranscriptionSpeakerClientData["colorToken"],
        orderIndex: speaker.orderIndex,
        isUnknown: speaker.isUnknown,
      },
    ])
  );

  return {
    fileNameBase: stripFileExtension(job.sourceFileName),
    displayFullText: job.displayFullText ?? null,
    segments: segmentRows.map((segment) => {
      const speaker = speakerMap.get(segment.speakerId);
      const speakerLabel =
        segment.speakerLabelOverride?.trim() ||
        speaker?.displayName ||
        speaker?.defaultLabel ||
        null;
      return {
        startMs: segment.startMs,
        endMs: segment.endMs,
        speakerId: segment.speakerId,
        speaker: speakerLabel,
        text: segment.textCurrent,
        isEdited: segment.isEdited,
        sourceStartIndex: segment.sourceStartIndex,
        sourceEndIndex: segment.sourceEndIndex,
      };
    }),
  };
}

async function loadTextOnlyExportData(job: TranscriptionJob): Promise<LoadedExportData> {
  const segmentRows = await db
    .select({
      text: transcriptionDisplaySegments.textCurrent,
    })
    .from(transcriptionDisplaySegments)
    .where(eq(transcriptionDisplaySegments.transcriptionJobId, job.id))
    .orderBy(asc(transcriptionDisplaySegments.orderIndex));

  return {
    fileNameBase: stripFileExtension(job.sourceFileName),
    displayFullText: job.displayFullText ?? null,
    segments: segmentRows.map((segment) => ({
      startMs: 0,
      endMs: 0,
      speaker: null,
      text: segment.text,
    })),
  };
}

function buildTxtFile(
  data: LoadedExportData,
  options: TranscriptionExportOptions
): BuiltExportFile {
  const content =
    !options.showSpeakerNames && !options.showTimestamps && data.displayFullText?.trim()
      ? data.displayFullText.trim()
      : renderReadableBlocksAsPlainText(
          buildReadableExportBlocks(data.segments, options)
        );

  return {
    contentType: "text/plain; charset=utf-8",
    fileName: buildExportFileName(data.fileNameBase, "txt"),
    buffer: Buffer.from(content, "utf8"),
  };
}

function buildCsvFile(
  data: LoadedExportData,
  options: TranscriptionExportOptions
): BuiltExportFile {
  const header = ["start_time", "end_time", "speaker", "text"].join(",");
  const rows = data.segments.map((segment) =>
    [
      options.showTimestamps ? formatTimestamp(segment.startMs) : "",
      options.showTimestamps ? formatTimestamp(segment.endMs) : "",
      options.showSpeakerNames ? segment.speaker ?? "" : "",
      segment.text,
    ]
      .map((value) => escapeCsvCell(value))
      .join(",")
  );

  return {
    contentType: "text/csv; charset=utf-8",
    fileName: buildExportFileName(data.fileNameBase, "csv"),
    buffer: Buffer.from([header, ...rows].join("\n"), "utf8"),
  };
}

function getUneditedSegmentWords(
  segment: ExportSegment,
  rawSegments: ReturnType<typeof coerceTranscriptionSegments>
): Array<{ startMs: number; endMs: number; text: string }> | null {
  if (
    segment.isEdited ||
    segment.sourceStartIndex === undefined ||
    segment.sourceEndIndex === undefined ||
    segment.sourceStartIndex < 0 ||
    segment.sourceEndIndex < segment.sourceStartIndex
  ) {
    return null;
  }

  const words = rawSegments
    .slice(segment.sourceStartIndex, segment.sourceEndIndex + 1)
    .flatMap((rawSegment) => rawSegment.words ?? [])
    .filter(
      (word) =>
        word.text.trim() &&
        word.endMs >= word.startMs &&
        word.endMs >= segment.startMs &&
        word.startMs <= segment.endMs
    );

  return words.length ? words : null;
}

function buildSubtitleFile(
  job: TranscriptionJob,
  data: LoadedExportData,
  format: "srt" | "vtt",
  subtitleLayout?: SubtitleLayoutOptions,
  showSpeakerNames = false
): BuiltExportFile {
  const layout = normalizeSubtitleLayoutOptions(subtitleLayout);
  const rawSegments = coerceTranscriptionSegments(job.segmentsJson);
  const cues = normalizeSubtitleCues(data.segments.flatMap((segment) => {
    const words = getUneditedSegmentWords(segment, rawSegments);
    if (words) {
      return buildWordSubtitleCues(
        {
          startMs: segment.startMs,
          endMs: segment.endMs,
          speakerId: segment.speakerId,
          speakerLabel: segment.speaker,
          text: segment.text,
          words,
        },
        layout
      );
    }

    return buildSubtitleCues(
      [{
        startMs: segment.startMs,
        endMs: segment.endMs,
        speakerId: segment.speakerId,
        speakerLabel: segment.speaker,
        text: segment.text,
      }],
      layout
    );
  }));
  const isSrt = format === "srt";

  return {
    contentType: isSrt ? "application/x-subrip; charset=utf-8" : "text/vtt; charset=utf-8",
    fileName: buildExportFileName(data.fileNameBase, format),
    buffer: Buffer.from(
      isSrt ? renderSrt(cues, showSpeakerNames) : renderVtt(cues, showSpeakerNames),
      "utf8"
    ),
  };
}

async function buildPdfFile(
  data: LoadedExportData,
  options: TranscriptionExportOptions
): Promise<BuiltExportFile> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
  });

  const marginX = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let currentY = 56;

  configurePdfExportFont(pdf);
  setPdfExportFont(pdf, "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(11, 18, 32);
  pdf.text(data.fileNameBase, marginX, currentY);
  currentY += 30;

  const blocks = buildReadableExportBlocks(data.segments, options);
  for (const block of blocks) {
    let labelLines: string[] = [];
    if (block.labelLine) {
      setPdfExportFont(pdf, "bold");
      pdf.setFontSize(11);
      labelLines = pdf.splitTextToSize(block.labelLine, maxWidth);
    }

    setPdfExportFont(pdf, "normal");
    pdf.setFontSize(11);
    const bodyLines = pdf.splitTextToSize(block.bodyText, maxWidth);

    const requiredHeight =
      labelLines.length * 15 +
      bodyLines.length * 16 +
      (labelLines.length > 0 ? 4 : 0) +
      12;

    if (currentY + requiredHeight > pageHeight - 48) {
      pdf.addPage();
      currentY = 56;
    }

    if (labelLines.length > 0) {
      setPdfExportFont(pdf, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);
      for (const line of labelLines) {
        pdf.text(line, marginX, currentY);
        currentY += 15;
      }
      currentY += 4;
    }

    setPdfExportFont(pdf, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(17, 24, 39);
    for (const line of bodyLines) {
      pdf.text(line, marginX, currentY);
      currentY += 16;
    }

    currentY += 12;
  }

  return {
    contentType: "application/pdf",
    fileName: buildExportFileName(data.fileNameBase, "pdf"),
    buffer: Buffer.from(pdf.output("arraybuffer")),
  };
}

async function buildDocxFile(
  data: LoadedExportData,
  options: TranscriptionExportOptions
): Promise<BuiltExportFile> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
  } = await import("docx");
  const documentFontFamily = getPreferredDocumentFontFamily();
  const blocks = buildReadableExportBlocks(data.segments, options);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            spacing: {
              after: 240,
            },
            children: [
              new TextRun({
                text: data.fileNameBase,
                bold: true,
                size: 34,
                color: "0F172A",
                font: {
                  ascii: documentFontFamily,
                  hAnsi: documentFontFamily,
                  eastAsia: documentFontFamily,
                },
              }),
            ],
          }),
          ...blocks.flatMap((block) => {
            const paragraphs = [];
            if (block.labelLine) {
              paragraphs.push(
                new Paragraph({
                  spacing: {
                    after: 40,
                  },
                  children: [
                    new TextRun({
                      text: block.labelLine,
                      bold: true,
                      size: 22,
                      color: "334155",
                      font: {
                        ascii: documentFontFamily,
                        hAnsi: documentFontFamily,
                        eastAsia: documentFontFamily,
                      },
                    }),
                  ],
                })
              );
            }
            paragraphs.push(
              new Paragraph({
                spacing: {
                  after: 180,
                },
                children: [
                  new TextRun({
                    text: block.bodyText,
                    size: 22,
                    color: "1F2937",
                    font: {
                      ascii: documentFontFamily,
                      hAnsi: documentFontFamily,
                      eastAsia: documentFontFamily,
                    },
                  }),
                ],
              })
            );
            return paragraphs;
          }),
        ],
      },
    ],
  });

  return {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileName: buildExportFileName(data.fileNameBase, "docx"),
    buffer: Buffer.from(await Packer.toBuffer(doc)),
  };
}

async function buildOptimizedTxtFile(
  job: TranscriptionJob,
  options: TranscriptionExportOptions
): Promise<BuiltExportFile> {
  const fastPathFile = buildPlainTxtFileFromJob(job);
  if (fastPathFile && shouldUsePlainTxtFastPath(options)) {
    return fastPathFile;
  }

  const data =
    options.showTimestamps && !options.showSpeakerNames
      ? await loadTxtSegmentsWithTimestamps(job)
      : await loadTxtSegmentsWithLabels(job, options.showTimestamps);

  return buildTxtFile(data, options);
}

async function buildOptimizedCsvFile(
  job: TranscriptionJob,
  options: TranscriptionExportOptions
): Promise<BuiltExportFile> {
  const data = options.showSpeakerNames
    ? await loadTxtSegmentsWithLabels(job, options.showTimestamps)
    : options.showTimestamps
      ? await loadTxtSegmentsWithTimestamps(job)
      : await loadTextOnlyExportData(job);

  return buildCsvFile(data, options);
}

export async function buildTranscriptionExportFile(
  job: TranscriptionJob,
  options: TranscriptionExportOptions
): Promise<BuiltExportFile> {
  if (options.format === "txt") {
    return buildOptimizedTxtFile(job, options);
  }

  switch (options.format) {
    case "csv":
      return buildOptimizedCsvFile(job, options);
    case "pdf":
      return await buildPdfFile(await loadExportData(job), options);
    case "docx":
      return buildDocxFile(await loadExportData(job), options);
    case "srt":
    case "vtt":
      return buildSubtitleFile(
        job,
        await loadExportData(job),
        options.format,
        options.subtitleLayout,
        options.showSpeakerNames
      );
    default:
      throw new Error("Unsupported export format");
  }
}
