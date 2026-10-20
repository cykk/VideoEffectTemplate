import { hierarchy, tree } from "d3-hierarchy";
import type { TranscriptionMindMapNode } from "@markless/shared/src/types/transcriptions";

export const MIND_MAP_FONT_SIZE = 14;
export const MIND_MAP_LINE_HEIGHT = 20;
export const MIND_MAP_MAX_LABEL_WIDTH = 280;
export const MIND_MAP_LABEL_SAFETY_MARGIN = 12;
export const MIND_MAP_MAX_LABEL_CONTENT_WIDTH =
  MIND_MAP_MAX_LABEL_WIDTH - MIND_MAP_LABEL_SAFETY_MARGIN;
export const MIND_MAP_HORIZONTAL_GAP = 56;
export const MIND_MAP_VERTICAL_GAP = 20;
export const MIND_MAP_PADDING = 24;
export const MIND_MAP_RENDER_PADDING = 12;
export const MIND_MAP_UNDERLINE_OFFSET = 6;
export const MIND_MAP_JUNCTION_RADIUS = 4;
export const MIND_MAP_LINE_STROKE_WIDTH = 1.5;

export type MindMapLayoutNode = {
  id: string;
  label: string;
  lines: string[];
  type: TranscriptionMindMapNode["type"];
  width: number;
  height: number;
  x: number;
  y: number;
  children: MindMapLayoutNode[];
};

export type MindMapLayoutLink = {
  id: string;
  source: MindMapLayoutNode;
  target: MindMapLayoutNode;
};

export type MindMapLayoutResult = {
  nodes: MindMapLayoutNode[];
  links: MindMapLayoutLink[];
  width: number;
  height: number;
};

type HierarchyDatumFromLayout = {
  id: string;
  label: string;
  type: TranscriptionMindMapNode["type"];
  ref: MindMapLayoutNode;
  children?: HierarchyDatumFromLayout[];
};

function clampLabelWidth(width: number): number {
  return Math.max(48, Math.min(MIND_MAP_MAX_LABEL_WIDTH, width));
}

function createMeasureTextWidth(): (label: string) => number {
  if (typeof document === "undefined") {
    return (label: string) =>
      Math.ceil(label.length * MIND_MAP_FONT_SIZE * 0.62) + 4;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return (label: string) =>
      Math.ceil(label.length * MIND_MAP_FONT_SIZE * 0.62) + 4;
  }

  context.font = `500 ${MIND_MAP_FONT_SIZE}px Inter, ui-sans-serif, system-ui, sans-serif`;

  return (label: string) => Math.ceil(context.measureText(label).width) + 4;
}

function isCjkCharacter(character: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u.test(
    character
  );
}

function splitLabelTokens(label: string): string[] {
  const tokens: string[] = [];
  let latinToken = "";

  const flushLatinToken = () => {
    if (latinToken) {
      tokens.push(latinToken);
      latinToken = "";
    }
  };

  for (const character of label.trim()) {
    if (isCjkCharacter(character)) {
      flushLatinToken();
      tokens.push(character);
    } else if (/\s/u.test(character)) {
      flushLatinToken();
    } else {
      latinToken += character;
    }
  }

  flushLatinToken();
  return tokens;
}

function wrapMindMapLabel(
  label: string,
  measureTextWidth: (value: string) => number
): string[] {
  const normalized = label.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const token of splitLabelTokens(normalized)) {
    const candidate = current
      ? isCjkCharacter(token)
        ? `${current}${token}`
        : `${current} ${token}`
      : token;

    if (current && measureTextWidth(candidate) > MIND_MAP_MAX_LABEL_CONTENT_WIDTH) {
      lines.push(current);
      current = token;
    } else if (!current && measureTextWidth(candidate) > MIND_MAP_MAX_LABEL_CONTENT_WIDTH) {
      let partial = "";
      for (const character of token) {
        const next = `${partial}${character}`;
        if (partial && measureTextWidth(next) > MIND_MAP_MAX_LABEL_CONTENT_WIDTH) {
          lines.push(partial);
          partial = character;
        } else {
          partial = next;
        }
      }
      current = partial;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [normalized];
}

function buildLayoutTree(
  node: TranscriptionMindMapNode,
  measureTextWidth: (label: string) => number
): MindMapLayoutNode {
  const lines = wrapMindMapLabel(node.label, measureTextWidth);
  return {
    id: node.id,
    label: node.label,
    lines,
    type: node.type,
    width: clampLabelWidth(
      Math.max(...lines.map(measureTextWidth)) + MIND_MAP_LABEL_SAFETY_MARGIN
    ),
    height: lines.length * MIND_MAP_LINE_HEIGHT + MIND_MAP_UNDERLINE_OFFSET + 4,
    x: 0,
    y: 0,
    children: node.children.map((child) => buildLayoutTree(child, measureTextWidth)),
  };
}

function flattenLayoutTree(node: MindMapLayoutNode): MindMapLayoutNode[] {
  return [node, ...node.children.flatMap(flattenLayoutTree)];
}

function toHierarchyDatumFromLayout(node: MindMapLayoutNode): HierarchyDatumFromLayout {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    ref: node,
    children:
      node.children.length > 0
        ? node.children.map(toHierarchyDatumFromLayout)
        : undefined,
  };
}

function assignDepthPositions(
  layoutRoot: MindMapLayoutNode,
  measureTextWidth: (label: string) => number
): void {
  const root = hierarchy(toHierarchyDatumFromLayout(layoutRoot), (node) => node.children);
  const maxWidthByDepth = new Map<number, number>();

  root.each((node) => {
    const width = clampLabelWidth(
      Math.max(...node.data.ref.lines.map(measureTextWidth)) + MIND_MAP_LABEL_SAFETY_MARGIN
    );
    maxWidthByDepth.set(node.depth, Math.max(maxWidthByDepth.get(node.depth) ?? 0, width));
  });

  const maxNodeHeight = Math.max(...flattenLayoutTree(layoutRoot).map((node) => node.height));

  const depthOffset = (depth: number) => {
    let offset = MIND_MAP_PADDING;
    for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
      offset += (maxWidthByDepth.get(currentDepth) ?? 0) + MIND_MAP_HORIZONTAL_GAP;
    }
    return offset;
  };

  const treeLayout = tree<HierarchyDatumFromLayout>()
    .nodeSize([maxNodeHeight + MIND_MAP_VERTICAL_GAP, 1])
    .separation(() => 1);

  const positionedRoot = treeLayout(root);

  positionedRoot.each((node) => {
    const layoutNode = node.data.ref;
    layoutNode.x = depthOffset(node.depth);
    layoutNode.y = node.x + MIND_MAP_PADDING;
    layoutNode.width = clampLabelWidth(
      Math.max(...layoutNode.lines.map(measureTextWidth)) + MIND_MAP_LABEL_SAFETY_MARGIN
    );
  });
}

function buildLinks(nodes: MindMapLayoutNode[]): MindMapLayoutLink[] {
  const links: MindMapLayoutLink[] = [];

  const visit = (node: MindMapLayoutNode) => {
    for (const child of node.children) {
      links.push({
        id: `${node.id}->${child.id}`,
        source: node,
        target: child,
      });
      visit(child);
    }
  };

  if (nodes[0]) {
    visit(nodes[0]);
  }

  return links;
}

export function layoutMindMap(root: TranscriptionMindMapNode): MindMapLayoutResult {
  const measureTextWidth = createMeasureTextWidth();
  const layoutRoot = buildLayoutTree(root, measureTextWidth);
  assignDepthPositions(layoutRoot, measureTextWidth);

  const nodes = flattenLayoutTree(layoutRoot);
  const links = buildLinks(nodes);

  const maxX = Math.max(...nodes.map((node) => node.x + node.width), 0);
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2), 0);
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2), 0);

  return {
    nodes,
    links,
    width: maxX + MIND_MAP_PADDING + MIND_MAP_LABEL_SAFETY_MARGIN,
    height: maxY - minY + MIND_MAP_PADDING * 2 + MIND_MAP_RENDER_PADDING * 2,
  };
}

export function buildMindMapLinkPath(
  source: MindMapLayoutNode,
  target: MindMapLayoutNode
): string {
  const startX = source.x + source.width;
  const startY = source.y;
  const endX = target.x;
  const endY = target.y;
  const midX = startX + (endX - startX) / 2;

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}
