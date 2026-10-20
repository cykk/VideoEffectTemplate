export type TranscriptionUploadSourceType = "audio" | "video";

type SupportedMediaFormat = {
  sourceType: TranscriptionUploadSourceType;
  extensions: readonly string[];
  mimeTypes: readonly string[];
};

const SUPPORTED_MEDIA_FORMATS: readonly SupportedMediaFormat[] = [
  { sourceType: "audio", extensions: ["aac"], mimeTypes: ["audio/aac"] },
  { sourceType: "audio", extensions: ["amr"], mimeTypes: ["audio/amr"] },
  { sourceType: "audio", extensions: ["awb"], mimeTypes: ["audio/amr-wb", "audio/awb"] },
  { sourceType: "audio", extensions: ["flac"], mimeTypes: ["audio/flac", "audio/x-flac"] },
  { sourceType: "audio", extensions: ["m4a"], mimeTypes: ["audio/mp4", "audio/x-m4a"] },
  { sourceType: "audio", extensions: ["mka"], mimeTypes: ["audio/x-matroska"] },
  { sourceType: "audio", extensions: ["mp2", "mp3"], mimeTypes: ["audio/mpeg"] },
  { sourceType: "audio", extensions: ["oga", "ogg", "opus"], mimeTypes: ["audio/ogg"] },
  { sourceType: "audio", extensions: ["wav"], mimeTypes: ["audio/wav", "audio/x-wav", "audio/wave"] },
  { sourceType: "audio", extensions: ["weba", "webm"], mimeTypes: ["audio/webm"] },
  { sourceType: "audio", extensions: ["wma"], mimeTypes: ["audio/x-ms-wma"] },
  { sourceType: "video", extensions: ["3gp"], mimeTypes: ["video/3gpp"] },
  { sourceType: "video", extensions: ["mkv"], mimeTypes: ["video/x-matroska"] },
  { sourceType: "video", extensions: ["mov"], mimeTypes: ["video/quicktime"] },
  { sourceType: "video", extensions: ["mp4"], mimeTypes: ["video/mp4"] },
  { sourceType: "video", extensions: ["mpg", "mpeg"], mimeTypes: ["video/mpeg"] },
  { sourceType: "video", extensions: ["ts"], mimeTypes: ["video/mp2t"] },
  { sourceType: "video", extensions: ["webm"], mimeTypes: ["video/webm"] },
  { sourceType: "video", extensions: ["wmv"], mimeTypes: ["video/x-ms-wmv"] },
];

function getFileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function getSupportedMediaFormatsByExtension(fileName: string): readonly SupportedMediaFormat[] {
  const extension = getFileExtension(fileName);
  return SUPPORTED_MEDIA_FORMATS.filter((format) => format.extensions.includes(extension));
}

function getSupportedMediaFormatByExtension(fileName: string): SupportedMediaFormat | null {
  const formats = getSupportedMediaFormatsByExtension(fileName);
  return formats.length === 1 ? formats[0] ?? null : null;
}

export function inferSupportedTranscriptionUploadSourceType(input: {
  fileName: string;
  contentType: string;
}): TranscriptionUploadSourceType | null {
  const contentType = input.contentType.trim().toLowerCase();
  const extensionFormats = getSupportedMediaFormatsByExtension(input.fileName);

  // A unique extension is more reliable than OS-specific browser MIME detection.
  if (extensionFormats.length === 1) {
    return extensionFormats[0]?.sourceType ?? null;
  }

  const matchingMimeFormat = extensionFormats.find((format) =>
    format.mimeTypes.includes(contentType)
  );
  return matchingMimeFormat?.sourceType ?? null;
}

/**
 * Normalizes browser-provided MIME values that vary by OS, notably for AAC files.
 */
export function resolveSupportedTranscriptionUploadContentType(input: {
  sourceType: TranscriptionUploadSourceType;
  fileName: string;
  contentType: string;
}): string | null {
  const contentType = input.contentType.trim().toLowerCase();
  const matchingExtensionFormat = getSupportedMediaFormatByExtension(input.fileName);
  if (matchingExtensionFormat) {
    return matchingExtensionFormat.sourceType === input.sourceType
      ? (matchingExtensionFormat.mimeTypes[0] ?? null)
      : null;
  }

  const matchingMimeFormat = getSupportedMediaFormatsByExtension(input.fileName).find(
    (format) => format.sourceType === input.sourceType && format.mimeTypes.includes(contentType)
  );
  if (!matchingMimeFormat) {
    return null;
  }

  return contentType;
}

export function isSupportedTranscriptionUpload(input: {
  sourceType: TranscriptionUploadSourceType;
  fileName: string;
  contentType: string;
}): boolean {
  return resolveSupportedTranscriptionUploadContentType(input) !== null;
}

export function getSupportedTranscriptionUploadMimeTypes(
  sourceType: TranscriptionUploadSourceType
): ReadonlySet<string> {
  return new Set(
    SUPPORTED_MEDIA_FORMATS.filter((format) => format.sourceType === sourceType).flatMap(
      (format) => format.mimeTypes
    )
  );
}

/**
 * Uses explicit extensions because desktop file pickers do not consistently map every audio MIME type.
 */
export function getSupportedTranscriptionUploadAccept(): string {
  const acceptValues = SUPPORTED_MEDIA_FORMATS.flatMap((format) => [
    ...format.extensions.map((extension) => `.${extension}`),
    ...format.mimeTypes,
  ]);

  return [...new Set(acceptValues)].join(",");
}
