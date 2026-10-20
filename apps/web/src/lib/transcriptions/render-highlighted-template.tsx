import type { ReactElement } from "react";

export function renderHighlightedTemplate(
  template: string,
  values: Record<string, string>,
  highlightClassName = "font-semibold text-primary"
): Array<ReactElement | string | null> {
  return template.split(/(\{[a-zA-Z]+\})/).map((part, index) => {
    const tokenMatch = part.match(/^\{([a-zA-Z]+)\}$/);
    if (tokenMatch) {
      const value = values[tokenMatch[1]];
      if (!value) {
        return null;
      }

      return (
        <span key={`${tokenMatch[1]}-${index}`} className={highlightClassName}>
          {value}
        </span>
      );
    }

    return part ? part : null;
  });
}
