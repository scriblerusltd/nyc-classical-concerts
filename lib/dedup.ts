import { Concert, ExtractedConcert } from "./types";
import { randomUUID } from "crypto";

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function dedupKey(concert: ExtractedConcert | Concert): string {
  const venue = normalize(concert.venue);
  // Normalize date to just YYYY-MM-DD for comparison
  const date = concert.date.split("T")[0];
  const performers = Array.isArray(concert.performers)
    ? concert.performers[0]
    : concert.performers;
  const titleOrPerformer = normalize(
    performers?.split(",")[0] || concert.title
  );
  return `${venue}:${date}:${titleOrPerformer}`;
}

function completenessScore(concert: ExtractedConcert): number {
  let score = 0;
  if (concert.title) score++;
  if (concert.date) score++;
  if (concert.venue) score++;
  if (concert.address) score++;
  if (concert.price && concert.price !== "See website") score++;
  if (concert.price_cents !== null) score++;
  if (concert.program) score++;
  if (concert.performers) score++;
  if (concert.source_url) score++;
  if (concert.tags.length > 0) score++;
  return score;
}

interface ExtractedWithSource extends ExtractedConcert {
  source_name: string;
  source_base_url: string;
}

export function deduplicateConcerts(
  concertsBySource: { source_name: string; source_url: string; concerts: ExtractedConcert[] }[]
): Concert[] {
  const seen = new Map<string, ExtractedWithSource>();

  for (const { source_name, source_url, concerts } of concertsBySource) {
    for (const concert of concerts) {
      const key = dedupKey(concert);
      const withSource: ExtractedWithSource = {
        ...concert,
        source_name,
        source_base_url: source_url, // keep base URL separate from event URL
      };

      const existing = seen.get(key);
      if (!existing || completenessScore(concert) > completenessScore(existing)) {
        seen.set(key, withSource);
      }
    }
  }

  const now = new Date().toISOString();

  return Array.from(seen.values()).map((c) => ({
    id: randomUUID(),
    title: c.title,
    date: c.date,
    venue: c.venue,
    address: c.address,
    price: c.price,
    price_cents: c.price_cents,
    program: c.program,
    performers: c.performers,
    source_url: c.source_url || c.source_base_url,
    source_name: c.source_name,
    description: null,
    tags: c.tags,
    created_at: now,
    updated_at: now,
  }));
}
