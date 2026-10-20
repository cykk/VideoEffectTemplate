import { MarketingHtmlText } from "@/components/marketing/marketing-html-text";

interface MarketingRichTextBlockProps {
  paragraphs?: string[];
  bulletsIntro?: string;
  bullets?: string[];
  closingParagraphs?: string[];
  description?: string;
}

export function MarketingRichTextBlock({
  paragraphs,
  bulletsIntro,
  bullets,
  closingParagraphs,
  description,
}: MarketingRichTextBlockProps) {
  const leadingParagraphs = paragraphs ?? (description ? [description] : []);

  return (
    <div className="space-y-4">
      {leadingParagraphs.map((paragraph) => (
        <MarketingHtmlText
          key={paragraph}
          as="div"
          html={paragraph}
          className="text-base leading-7 text-slate-600"
        />
      ))}

      {bulletsIntro || (bullets && bullets.length > 0) ? (
        <div className="space-y-1">
          {bulletsIntro ? (
            <p className="text-sm font-semibold text-slate-800">{bulletsIntro}</p>
          ) : null}

          {bullets && bullets.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-base leading-6 text-slate-600">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {closingParagraphs?.map((paragraph) => (
        <MarketingHtmlText
          key={paragraph}
          as="div"
          html={paragraph}
          className="text-base leading-7 text-slate-600"
        />
      ))}
    </div>
  );
}
