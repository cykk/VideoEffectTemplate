"use client";

import type { ReactNode } from "react";

export type TranscriptionViewShellProps = {
  header: ReactNode;
  children: ReactNode;
};

export function TranscriptionViewShell({ header, children }: TranscriptionViewShellProps) {
  return (
    <div className="flex h-[100svh] w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        {header}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}

