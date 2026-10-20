"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@markless/shared/src/lib/utils";

interface BlogMarkdownProps {
  content: string;
  className?: string;
}

function MarkdownLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http");

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 transition-colors hover:text-brand-700"
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 transition-colors hover:text-brand-700"
      {...props}
    >
      {children}
    </Link>
  );
}

export function BlogMarkdown({ content, className }: BlogMarkdownProps) {
  return (
    <div
      className={cn(
        "blog-markdown space-y-5 text-base leading-7 text-slate-700",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight text-slate-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 scroll-mt-24 text-xl font-semibold text-slate-900">
              {children}
            </h3>
          ),
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-2 pl-6 marker:text-brand-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-2 pl-6 marker:font-medium marker:text-brand-600">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-200 bg-brand-50/60 px-4 py-3 text-slate-700">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.includes("language-");

            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
                  {children}
                </code>
              );
            }

            return (
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-medium text-slate-800">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
              {children}
            </pre>
          ),
          a: MarkdownLink,
          hr: () => <hr className="my-10 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
