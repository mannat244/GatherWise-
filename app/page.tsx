export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          GatherWise Core Engine Ready
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Plan real events with conversational clarity.
        </h1>
        <p className="text-base text-stone-600 sm:text-lg">
          Turn free-form ideas into structured checklists, grounded venues, and constraint-aware budgets.
        </p>
      </div>
    </main>
  );
}
