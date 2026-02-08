import { Concert, ExtractedConcert } from "./types";
import { randomUUID } from "crypto";

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Generate all possible dedup keys for a concert (venue:date:identifier)
function dedupKeys(concert: ExtractedConcert | Concert): string[] {
  const venue = normalizeVenue(concert.venue);
  const date = concert.date.split("T")[0];
  const performers = Array.isArray(concert.performers)
    ? concert.performers[0]
    : concert.performers;

  const keys: string[] = [];
  // Primary key: performers-based (if available)
  if (performers) {
    keys.push(`${venue}:${date}:${normalize(performers.split(",")[0])}`);
  }
  // Secondary key: title-based
  keys.push(`${venue}:${date}:${normalize(concert.title)}`);
  return keys;
}

// Normalize venue names so "Merkin Concert Hall" and "Merkin Hall" match
function normalizeVenue(venue: string): string {
  const v = normalize(venue);
  // Map common venue name variants to a canonical form
  const aliases: [RegExp, string][] = [
    [/merkin(concert)?hall/, "merkinhall"],
    [/kaufman.*merkin/, "merkinhall"],
    [/alicetully(hall)?/, "alicetullyhall"],
    [/davidgeffen(hall)?/, "davidgeffenhall"],
    [/weillrecital(hall)?.*carnegie/, "weillhall"],
    [/zankel(hall)?.*carnegie/, "zankelhall"],
    [/carnegiehall$/, "carnegiehall"],
    [/92n(d)?y|92ndstreety/, "92ny"],
    [/metropolitanopera(house)?/, "metopera"],
    [/cathedral.*st.*john.*divine/, "stjohndivine"],
  ];
  for (const [pattern, canonical] of aliases) {
    if (pattern.test(v)) return canonical;
  }
  return v;
}

// Common abbreviation expansions in classical music
const EXPANSIONS: Record<string, string> = {
  ny: "newyork",
  phil: "philharmonic",
  orch: "orchestra",
  sym: "symphony",
  qt: "quartet",
  str: "string",
};

// Extract significant words from a title, expanding common abbreviations
function titleWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => EXPANSIONS[w] || w)
    // Remove venue-like words that don't help with matching
    .filter((w) => !["at", "in", "the", "of", "and", "hall", "merkin", "concert", "recital"].includes(w));
  return new Set(words);
}

// Check if two dedup keys are a fuzzy match
function fuzzyKeyMatch(key1: string, key2: string): boolean {
  if (key1 === key2) return true;

  const [venue1, date1, title1] = key1.split(":");
  const [venue2, date2, title2] = key2.split(":");

  if (venue1 !== venue2 || date1 !== date2) return false;

  // One normalized title is a prefix of the other
  if (title1.startsWith(title2) || title2.startsWith(title1)) return true;

  return false;
}

// Broader check: do two concerts at the same venue/date represent the same event?
// Uses word-level matching with abbreviation expansion
function isSameEvent(concert1: ExtractedConcert | ExtractedWithSource, concert2: ExtractedConcert | ExtractedWithSource): boolean {
  // Must be at same venue and date
  if (normalizeVenue(concert1.venue) !== normalizeVenue(concert2.venue)) return false;
  if (concert1.date.split("T")[0] !== concert2.date.split("T")[0]) return false;

  // Compare title words with abbreviation expansion
  const words1 = titleWords(concert1.title);
  const words2 = titleWords(concert2.title);

  if (words1.size >= 2 && words2.size >= 2) {
    const overlap = [...words1].filter((w) => words2.has(w)).length;
    const smaller = Math.min(words1.size, words2.size);
    if (overlap >= 2 && overlap / smaller >= 0.5) return true;
  }

  return false;
}

// Score how "authoritative" a source is for a given field
// Venue-specific sources (Kaufman, Juilliard) are more reliable than aggregators (NYCR)
function isVenueSource(sourceName: string): boolean {
  const venueSpecific = [
    "Kaufman Music Center",
    "Juilliard",
    "Manhattan School of Music",
    "Trinity Church",
  ];
  return venueSpecific.some((v) => sourceName.includes(v));
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

// Merge two concert entries, preferring venue-specific sources for time/URL/price
// and aggregator sources (NYCR) for program/performers descriptions
function mergeEntries(
  existing: ExtractedWithSource,
  incoming: ExtractedWithSource
): ExtractedWithSource {
  const existingIsVenue = isVenueSource(existing.source_name);
  const incomingIsVenue = isVenueSource(incoming.source_name);

  // Determine which is the "venue" source and which is the "aggregator"
  let venue: ExtractedWithSource;
  let aggregator: ExtractedWithSource;

  if (incomingIsVenue && !existingIsVenue) {
    venue = incoming;
    aggregator = existing;
  } else if (existingIsVenue && !incomingIsVenue) {
    venue = existing;
    aggregator = incoming;
  } else {
    // Both are same type — prefer the more complete one
    return completenessScore(incoming) > completenessScore(existing)
      ? incoming
      : existing;
  }

  // Merge: venue source wins for time, URL, price; aggregator wins for program/performers
  return {
    // From venue source (authoritative for logistics)
    date: venue.date,
    venue: venue.venue,
    address: venue.address || aggregator.address,
    price: venue.price && venue.price !== "See website" ? venue.price : aggregator.price,
    price_cents: venue.price_cents ?? aggregator.price_cents,
    source_url: venue.source_url || aggregator.source_url,
    source_name: venue.source_name,
    source_base_url: venue.source_base_url,

    // From aggregator (usually richer descriptions)
    title: aggregator.title.length > venue.title.length ? aggregator.title : venue.title,
    program: aggregator.program || venue.program,
    performers: (aggregator.performers && aggregator.performers.length > (venue.performers?.length || 0))
      ? aggregator.performers
      : venue.performers,

    // Merge tags from both
    tags: [...new Set([...venue.tags, ...aggregator.tags])],

    // Keep ticket_url from venue if available
    ticket_url: venue.ticket_url || aggregator.ticket_url,
  };
}

export function deduplicateConcerts(
  concertsBySource: { source_name: string; source_url: string; concerts: ExtractedConcert[] }[]
): Concert[] {
  // Map from any key variant to the canonical key for that entry
  const keyToCanonical = new Map<string, string>();
  const canonicalToEntry = new Map<string, ExtractedWithSource>();

  for (const { source_name, source_url, concerts } of concertsBySource) {
    for (const concert of concerts) {
      const keys = dedupKeys(concert);
      const withSource: ExtractedWithSource = {
        ...concert,
        source_name,
        source_base_url: source_url,
      };

      // Check if any of our keys match an existing entry (exact or fuzzy)
      let matchedCanonical: string | null = null;

      for (const key of keys) {
        // Exact match
        if (keyToCanonical.has(key)) {
          matchedCanonical = keyToCanonical.get(key)!;
          break;
        }
        // Fuzzy match against all known keys
        for (const [existingKey, canonical] of keyToCanonical.entries()) {
          if (fuzzyKeyMatch(key, existingKey)) {
            matchedCanonical = canonical;
            break;
          }
        }
        if (matchedCanonical) break;
      }

      // If key matching didn't find it, try word-level matching on titles
      if (!matchedCanonical) {
        for (const [canonical, existingEntry] of canonicalToEntry.entries()) {
          if (isSameEvent(concert, existingEntry)) {
            matchedCanonical = canonical;
            break;
          }
        }
      }

      if (matchedCanonical) {
        // Merge with existing entry
        const existing = canonicalToEntry.get(matchedCanonical)!;
        canonicalToEntry.set(matchedCanonical, mergeEntries(existing, withSource));
        // Also register all new keys under the same canonical
        for (const key of keys) {
          keyToCanonical.set(key, matchedCanonical);
        }
      } else {
        // New entry — use first key as canonical
        const canonical = keys[0];
        for (const key of keys) {
          keyToCanonical.set(key, canonical);
        }
        canonicalToEntry.set(canonical, withSource);
      }
    }
  }

  const now = new Date().toISOString();

  return Array.from(canonicalToEntry.values()).map((c) => ({
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
    ticket_url: c.ticket_url || null,
    created_at: now,
    updated_at: now,
  }));
}
