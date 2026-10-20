import JSZip from "jszip";
import { nanoid } from "nanoid";
import type { TranscriptionMindMapNode } from "@markless/shared/src/types/transcriptions";

export function buildMindMapMarkdown(
  node: TranscriptionMindMapNode,
  depth: number = 0
): string {
  const prefix = depth === 0 ? "# " : `${"  ".repeat(Math.max(0, depth - 1))}- `;
  const lines = [`${prefix}${node.label}`];

  for (const child of node.children) {
    lines.push(buildMindMapMarkdown(child, depth + 1));
  }

  return lines.join("\n");
}

type XmindTopic = {
  id: string;
  class: "topic";
  title: string;
  structureClass?: string;
  children?: {
    attached: XmindTopic[];
  };
};

function createXmindId(prefix: string): string {
  return `${prefix}-${nanoid()}`;
}

function convertNodeToXmindTopic(
  node: TranscriptionMindMapNode,
  isRoot: boolean
): XmindTopic {
  const topic: XmindTopic = {
    id: createXmindId(node.id),
    class: "topic",
    title: node.label,
  };

  if (isRoot) {
    topic.structureClass = "org.xmind.ui.logic.right";
  }

  if (node.children.length > 0) {
    topic.children = {
      attached: node.children.map((child) => convertNodeToXmindTopic(child, false)),
    };
  }

  return topic;
}

export async function buildMindMapXmindBlob(root: TranscriptionMindMapNode): Promise<Blob> {
  const sheetId = createXmindId("sheet");
  const content = [
    {
      id: sheetId,
      class: "sheet",
      title: "Sheet 1",
      rootTopic: convertNodeToXmindTopic(root, true),
    },
  ];

  const zip = new JSZip();
  zip.file("content.json", JSON.stringify(content));
  zip.file(
    "manifest.json",
    JSON.stringify({
      "file-entries": {
        "content.json": {},
        "metadata.json": {},
      },
    })
  );
  zip.file(
    "metadata.json",
    JSON.stringify({
      creator: {
        name: "mp3totext.io",
        version: "1.0.0",
      },
    })
  );

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function buildMindMapPngBlob(svgElement: SVGSVGElement): Promise<Blob> {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  const viewBox = svgElement.viewBox.baseVal;
  const width = viewBox.width || svgElement.clientWidth || 1;
  const height = viewBox.height || svgElement.clientHeight || 1;

  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const svgUrl = URL.createObjectURL(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
  );

  try {
    const image = await loadImage(svgUrl);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to encode PNG"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to render mind map image"));
    image.src = url;
  });
}

export function triggerMindMapDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
