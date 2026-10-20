import type { ReactElement } from "react";

export type TranscriptHighlightRange = {
  start: number;
  end: number;
  isCurrent?: boolean;
};

export function renderTranscriptHighlight(
  text: string,
  ranges: TranscriptHighlightRange[],
  options?: {
    currentMatchId?: string;
    currentMatchClassName?: string;
    matchClassName?: string;
  }
): Array<ReactElement | string> {
  if (!ranges.length) {
    return [text];
  }

  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start);
  const nodes: Array<ReactElement | string> = [];
  let cursor = 0;

  sortedRanges.forEach((range, index) => {
    if (range.start > cursor) {
      nodes.push(text.slice(cursor, range.start));
    }

    const className = range.isCurrent
      ? options?.currentMatchClassName ?? "rounded-sm bg-brand-500 px-0.5 text-white"
      : options?.matchClassName ?? "rounded-sm bg-brand-100 px-0.5 text-brand-900";

    nodes.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        id={range.isCurrent ? options?.currentMatchId : undefined}
        className={className}
      >
        {text.slice(range.start, range.end)}
      </mark>
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
