export interface Concert {
  id: string;
  title: string;
  date: string; // ISO 8601
  venue: string;
  address: string | null;
  price: string; // "Free", "$10", "Pay what you wish", etc.
  price_cents: number | null; // 0 for free, null if unclear
  program: string | null; // composers and works
  performers: string | null; // names and instruments/roles
  source_url: string | null;
  source_name: string;
  description: string | null;
  tags: string[]; // "free", "cheap", "student", "church", "chamber", etc.
  ticket_url: string | null; // direct link to buy tickets
  created_at: string;
  updated_at: string;
}

// What Claude returns from extraction (before we add IDs and timestamps)
export interface ExtractedConcert {
  title: string;
  date: string;
  venue: string;
  address: string | null;
  price: string;
  price_cents: number | null;
  program: string | null;
  performers: string | null;
  source_url: string | null;
  ticket_url?: string | null; // direct link to buy tickets
  tags: string[];
}

export interface Source {
  name: string;
  url: string;
  fetch: () => Promise<string>; // returns cleaned HTML for Claude
  directExtract?: () => Promise<ExtractedConcert[]>; // skip Claude, return structured data directly
}

export const VALID_TAGS = [
  "free",
  "cheap",
  "student",
  "church",
  "chamber",
  "orchestral",
  "solo",
  "choral",
  "organ",
  "opera",
  "new-music",
  "family",
] as const;

export type ConcertTag = (typeof VALID_TAGS)[number];
