import { Concert } from "@/lib/types";
import { getConcerts } from "@/lib/db";
import ConcertList from "./components/ConcertList";

// Revalidate every 6 hours so we pick up new data after cron runs
export const revalidate = 21600;

async function loadConcerts(): Promise<Concert[]> {
  try {
    return await getConcerts({
      from: new Date().toISOString().split("T")[0],
    });
  } catch {
    // Fallback to static JSON if Supabase isn't available
    const concertData = (await import("../public/concerts.json")).default;
    const now = new Date().toISOString().split("T")[0];
    return (concertData as Concert[])
      .filter((c) => c.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export default async function Home() {
  const concerts = await loadConcerts();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            NYC Classical Concerts
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Free and cheap classical music in New York City
          </p>
        </div>
      </header>

      {/* Concert list with filters */}
      <ConcertList concerts={concerts} />

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-2xl px-4 py-6 text-xs text-stone-400 dark:text-stone-500">
          <p>
            Updated every 3 days. Sources: New York Classical Review, Trinity
            Church NYC, Kaufman Music Center, Juilliard, Manhattan School of
            Music.
          </p>
        </div>
      </footer>
    </div>
  );
}
