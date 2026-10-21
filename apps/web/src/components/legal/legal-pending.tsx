export function LegalPending({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex min-h-[55vh] max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </main>
  );
}
