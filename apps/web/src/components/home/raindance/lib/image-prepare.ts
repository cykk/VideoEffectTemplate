/** 上传前在浏览器里处理照片：解码（含 HEIC，依赖浏览器原生解码）、限制长边、统一转成 JPEG。 */

export type PhotoErrorCode = "fileType" | "decode" | "tooLarge";

export class PhotoError extends Error {
  constructor(public readonly code: PhotoErrorCode) {
    super(code);
  }
}

const MAX_LONG_EDGE = 2048;
const MAX_OUTPUT_BYTES = 7 * 1024 * 1024;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const HEIC_NAME_PATTERN = /\.(heic|heif)$/i;

function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || HEIC_NAME_PATTERN.test(file.name);
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 回退到 <img> 解码，Safari 对 HEIC 通常走这条路径
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("decode");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!looksLikeImage(file)) throw new PhotoError("fileType");
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError("tooLarge");

  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new PhotoError("decode");
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoError("decode");
    // 透明 PNG 转 JPEG 时用白底，避免出现黑底
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.88, 0.78, 0.65]) {
      const blob = await toBlob(canvas, quality);
      if (!blob) throw new PhotoError("decode");
      if (blob.size <= MAX_OUTPUT_BYTES) return blob;
    }
    throw new PhotoError("tooLarge");
  } finally {
    decoded.release();
  }
}
