import { existsSync, readFileSync } from "fs";
import path from "path";

const EXPORT_FONT_DIRECTORY = path.join(
  process.cwd(),
  "packages",
  "shared",
  "src",
  "assets",
  "transcription-export-fonts"
);

const PDF_FONT_REGULAR_FILE_NAME = "NotoSansSC-Regular.ttf";
const PDF_FONT_BOLD_FILE_NAME = "NotoSansSC-Bold.ttf";
const PDF_FONT_REGULAR_VFS_NAME = "TransvioExportFont-Regular.ttf";
const PDF_FONT_BOLD_VFS_NAME = "TransvioExportFont-Bold.ttf";
const PDF_FONT_FAMILY = "TransvioExportFont";
const PDF_FONT_ENV_PATH = process.env.TRANSCRIPTION_EXPORT_PDF_FONT_PATH?.trim() || null;

type PdfFontRegistrationTarget = {
  addFileToVFS: (name: string, data: string) => void;
  addFont: (postScriptName: string, fontName: string, fontStyle: string) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
};

let cachedPdfRegularFontBase64: string | null | undefined;
let cachedPdfBoldFontBase64: string | null | undefined;
let missingPdfFontLogged = false;

function resolvePdfFontPath(fileName: string): string {
  if (PDF_FONT_ENV_PATH) {
    return path.join(PDF_FONT_ENV_PATH, fileName);
  }

  return path.join(EXPORT_FONT_DIRECTORY, fileName);
}

function readPdfFontBase64(
  fileName: string,
  cache: string | null | undefined
): string | null | undefined {
  if (cache !== undefined) {
    return cache;
  }

  const fontPath = resolvePdfFontPath(fileName);
  if (!existsSync(fontPath)) {
    if (!missingPdfFontLogged) {
      missingPdfFontLogged = true;
      console.error("[Transcriptions] PDF export font file is missing", fontPath);
    }
    return null;
  }

  try {
    return readFileSync(fontPath).toString("base64");
  } catch (error) {
    console.error("[Transcriptions] Failed to read PDF export font", fontPath, error);
    return null;
  }
}

function getPdfRegularFontBase64(): string | null {
  if (cachedPdfRegularFontBase64 === undefined) {
    cachedPdfRegularFontBase64 =
      readPdfFontBase64(PDF_FONT_REGULAR_FILE_NAME, cachedPdfRegularFontBase64) ?? null;
  }

  return cachedPdfRegularFontBase64;
}

function getPdfBoldFontBase64(): string | null {
  if (cachedPdfBoldFontBase64 === undefined) {
    cachedPdfBoldFontBase64 =
      readPdfFontBase64(PDF_FONT_BOLD_FILE_NAME, cachedPdfBoldFontBase64) ?? null;
  }

  return cachedPdfBoldFontBase64;
}

export function getPreferredDocumentFontFamily(): string {
  return process.env.TRANSCRIPTION_EXPORT_DOCX_FONT_FAMILY?.trim() || "Microsoft YaHei";
}

export function configurePdfExportFont(doc: PdfFontRegistrationTarget): void {
  const regularFontBase64 = getPdfRegularFontBase64();
  const boldFontBase64 = getPdfBoldFontBase64();
  if (!regularFontBase64 || !boldFontBase64) {
    doc.setFont("helvetica", "normal");
    return;
  }

  doc.addFileToVFS(PDF_FONT_REGULAR_VFS_NAME, regularFontBase64);
  doc.addFont(PDF_FONT_REGULAR_VFS_NAME, PDF_FONT_FAMILY, "normal");
  doc.addFileToVFS(PDF_FONT_BOLD_VFS_NAME, boldFontBase64);
  doc.addFont(PDF_FONT_BOLD_VFS_NAME, PDF_FONT_FAMILY, "bold");
  doc.setFont(PDF_FONT_FAMILY, "normal");
}

export function setPdfExportFont(
  doc: PdfFontRegistrationTarget,
  fontStyle: "normal" | "bold" = "normal"
): void {
  const fontBase64 =
    fontStyle === "bold" ? getPdfBoldFontBase64() : getPdfRegularFontBase64();
  if (!fontBase64) {
    doc.setFont("helvetica", fontStyle === "bold" ? "bold" : "normal");
    return;
  }

  doc.setFont(PDF_FONT_FAMILY, fontStyle);
}
