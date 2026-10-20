"use client";

import { forwardRef, useMemo } from "react";
import type { TranscriptionMindMapNode } from "@markless/shared/src/types/transcriptions";
import {
  buildMindMapLinkPath,
  layoutMindMap,
  MIND_MAP_FONT_SIZE,
  MIND_MAP_JUNCTION_RADIUS,
  MIND_MAP_LINE_HEIGHT,
  MIND_MAP_LINE_STROKE_WIDTH,
  MIND_MAP_PADDING,
  MIND_MAP_RENDER_PADDING,
  MIND_MAP_UNDERLINE_OFFSET,
  type MindMapLayoutResult,
} from "@/components/transcriptions/transcription-mind-map-layout";

export type TranscriptionMindMapSvgProps = {
  root: TranscriptionMindMapNode;
  ariaLabel?: string;
  layout?: MindMapLayoutResult;
};

export function useMindMapLayout(root: TranscriptionMindMapNode): MindMapLayoutResult {
  return useMemo(() => layoutMindMap(root), [root]);
}

export const TranscriptionMindMapSvg = forwardRef<SVGSVGElement, TranscriptionMindMapSvgProps>(
  function TranscriptionMindMapSvg({ root, ariaLabel, layout: layoutProp }, ref) {
    const layout = useMemo(
      () => layoutProp ?? layoutMindMap(root),
      [layoutProp, root]
    );

    const minCenterY = Math.min(...layout.nodes.map((node) => node.y), 0);

    return (
      <svg
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        width={layout.width}
        height={layout.height}
        className="cursor-default select-text"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <g transform={`translate(0 ${MIND_MAP_PADDING + MIND_MAP_RENDER_PADDING - minCenterY})`}>
          {layout.links.map((link) => (
            <path
              key={link.id}
              d={buildMindMapLinkPath(link.source, link.target)}
              fill="none"
              stroke="#58C1C8"
              strokeWidth={MIND_MAP_LINE_STROKE_WIDTH}
            />
          ))}

          {layout.nodes.map((node) => {
            const lineOffset = ((node.lines.length - 1) * MIND_MAP_LINE_HEIGHT) / 2;
            const textY = node.y - lineOffset - MIND_MAP_UNDERLINE_OFFSET;
            const underlineY = node.y + lineOffset + 2;
            const hasChildren = node.children.length > 0;

            return (
              <g key={node.id}>
                <text
                  x={node.x}
                  y={textY}
                  fill="#1E293B"
                  fontSize={MIND_MAP_FONT_SIZE}
                  fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                  fontWeight={node.type === "root" ? 600 : 500}
                  dominantBaseline="auto"
                  className="select-text"
                >
                  {node.lines.map((line, index) => (
                    <tspan
                      key={`${node.id}-line-${index}`}
                      x={node.x}
                      dy={index === 0 ? 0 : MIND_MAP_LINE_HEIGHT}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
                <line
                  x1={node.x}
                  y1={underlineY}
                  x2={node.x + node.width}
                  y2={underlineY}
                  stroke="#58C1C8"
                  strokeWidth={MIND_MAP_LINE_STROKE_WIDTH}
                />
                {hasChildren ? (
                  <circle
                    cx={node.x + node.width}
                    cy={node.y}
                    r={MIND_MAP_JUNCTION_RADIUS}
                    fill="#FFFFFF"
                    stroke="#58C1C8"
                    strokeWidth={MIND_MAP_LINE_STROKE_WIDTH}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    );
  }
);
