export default function PricingLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      <section className="px-4 pt-16 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto h-12 w-2/3 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="mx-auto mt-4 h-6 w-1/2 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
