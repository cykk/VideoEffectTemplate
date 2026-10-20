import { Fragment } from "react";
import Link from "next/link";

import type { RichText } from "@markless/shared/src/i18n";

interface RichTextContentProps {
    segments: RichText;
}

export function RichTextContent({ segments }: RichTextContentProps) {
    return (
        <>
            {segments.map((segment, index) => {
                if (segment.type === "code") {
                    return (
                        <code
                            key={`code-${index}`}
                            className="rounded bg-slate-200 px-1 py-0.5 text-xs text-slate-800"
                        >
                            {segment.value}
                        </code>
                    );
                }

                if (segment.type === "link") {
                    return (
                        <Link
                            key={`link-${index}`}
                            href={segment.url}
                            className="underline hover:text-foreground transition-colors"
                        >
                            {segment.text}
                        </Link>
                    );
                }

                return <Fragment key={`text-${index}`}>{segment.value}</Fragment>;
            })}
        </>
    );
}
