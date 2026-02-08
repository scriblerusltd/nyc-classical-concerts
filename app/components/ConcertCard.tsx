import { Concert } from "@/lib/types";

function formatDate(dateStr: string): { dayOfWeek: string; monthDay: string; time: string | null } {
  const date = new Date(dateStr);
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // If time is midnight (00:00), assume time wasn't provided
  if (hours === 0 && minutes === 0) {
    return { dayOfWeek, monthDay, time: null };
  }

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { dayOfWeek, monthDay, time };
}

function PriceTag({ price, priceCents }: { price: string; priceCents: number | null }) {
  const isFree = priceCents === 0 || price.toLowerCase() === "free";
  const isCheap = priceCents !== null && priceCents > 0 && priceCents <= 2000;

  if (isFree) {
    return (
      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        FREE
      </span>
    );
  }

  if (isCheap) {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        {price}
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
      {price || "See website"}
    </span>
  );
}

export default function ConcertCard({ concert }: { concert: Concert }) {
  const { dayOfWeek, monthDay, time } = formatDate(concert.date);

  const sourceHostname = concert.source_url
    ? new URL(concert.source_url).hostname.replace("www.", "")
    : null;

  return (
    <article className="group border-b border-stone-200 py-5 last:border-b-0 dark:border-stone-800">
      <div className="flex items-start gap-4">
        {/* Date column */}
        <div className="w-16 shrink-0 pt-0.5 text-center">
          <div className="text-xs font-semibold tracking-wider text-stone-400 dark:text-stone-500">
            {dayOfWeek}
          </div>
          <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
            {monthDay}
          </div>
          {time && (
            <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              {time}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-tight text-stone-900 dark:text-stone-100">
              {concert.title}
            </h3>
            <PriceTag price={concert.price} priceCents={concert.price_cents} />
          </div>

          <div className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {concert.venue}
          </div>

          {concert.program && (
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              {concert.program}
            </p>
          )}

          {concert.performers && (
            <p className="mt-1 text-sm italic text-stone-500 dark:text-stone-500">
              {Array.isArray(concert.performers)
                ? (concert.performers as string[]).join("; ")
                : concert.performers}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            {concert.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {concert.tags
                  .filter((t) => t !== "free" && t !== "cheap")
                  .map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-500"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}

            {concert.source_url && sourceHostname && (
              <a
                href={concert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto shrink-0 text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
              >
                {sourceHostname} &rarr;
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
