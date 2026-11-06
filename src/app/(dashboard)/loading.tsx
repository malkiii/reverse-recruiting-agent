/** Shown the moment the Admin navigates, until the page's data is in. */
export default function Loading() {
  const block = "animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={`${block} mb-6 h-7 w-40`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={`${block} h-20`} />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className={`${block} h-20`} />
        ))}
      </div>
    </div>
  );
}
