type TranscriptionSegmentPulsePlaceholderProps = {
  count?: number;
};

export function TranscriptionSegmentPulsePlaceholder({
  count = 3,
}: TranscriptionSegmentPulsePlaceholderProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
        >
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-[88%] animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-[72%] animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
