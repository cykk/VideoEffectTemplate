export type TranscriptSearchMatch = {
  segmentId: string;
  start: number;
  end: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTranscriptSearchRegExp(search: string): RegExp {
  return new RegExp(escapeRegExp(search), "gi");
}

export function findMatchesInText(
  text: string,
  search: string
): Array<{ start: number; end: number }> {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  const pattern = buildTranscriptSearchRegExp(trimmedSearch);
  const matches: Array<{ start: number; end: number }> = [];

  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

export function findTranscriptSearchMatches(
  segments: Array<{ id: string; text: string }>,
  search: string
): TranscriptSearchMatch[] {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  return segments.flatMap((segment) =>
    findMatchesInText(segment.text, trimmedSearch).map((range) => ({
      segmentId: segment.id,
      start: range.start,
      end: range.end,
    }))
  );
}

export function replaceMatchInText(
  text: string,
  match: Pick<TranscriptSearchMatch, "start" | "end">,
  replacement: string
): string {
  return `${text.slice(0, match.start)}${replacement}${text.slice(match.end)}`;
}
