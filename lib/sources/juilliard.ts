import { ExtractedConcert, Source } from "../types";

// Juilliard events via Juilcal's public Supabase API
// Data is already structured — no Claude extraction needed
// ~450 upcoming events with title, dateTime, venue, tags, link

const SUPABASE_URL = "https://zdwmhgrlcofyznavuvvm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkd21oZ3JsY29meXpuYXZ1dnZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzM0MzY1NiwiZXhwIjoyMDIyOTE5NjU2fQ.iHDquVJmkXHXm1hZf-0LuqAxflcDz9JFmIGqIYQmSxI";

interface JuilcalEvent {
  id: string;
  title: string;
  dateTime: string; // ISO 8601 UTC
  venue: string;
  link: string;
  tags: string; // comma-separated
  dayOfWeek: string;
}

function mapTags(juilcalTags: string): string[] {
  const tags: string[] = [];
  const raw = juilcalTags.toLowerCase();

  if (raw.includes("free")) tags.push("free");
  if (raw.includes("orchestra")) tags.push("orchestral");
  if (raw.includes("chamber")) tags.push("chamber");
  if (raw.includes("recital")) tags.push("solo");
  if (raw.includes("opera") || raw.includes("voice")) tags.push("opera");
  if (raw.includes("jazz")) tags.push("chamber");
  if (raw.includes("dance")) tags.push("family");
  if (raw.includes("organ")) tags.push("organ");
  if (raw.includes("choral") || raw.includes("chorus")) tags.push("choral");
  if (raw.includes("new music") || raw.includes("composition"))
    tags.push("new-music");
  if (raw.includes("student")) tags.push("student");

  return tags;
}

async function directExtract(): Promise<ExtractedConcert[]> {
  const now = new Date().toISOString();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/Events?select=*&dateTime=gte.${now}&order=dateTime.asc&limit=200`,
    {
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Juilcal API failed: ${response.status}`);
  }

  const events: JuilcalEvent[] = await response.json();

  return events.map((e) => {
    const tags = mapTags(e.tags || "");
    const isFree = (e.tags || "").toLowerCase().includes("free");

    // Juilcal stores times in UTC but they're actually ET local times.
    // Strip the Z suffix so they're treated as naive local times,
    // consistent with NYCR and Kaufman.
    const date = e.dateTime.replace(/Z$/, "");

    return {
      title: e.title,
      date,
      venue: e.venue || "Juilliard School",
      address: "60 Lincoln Center Plaza, New York, NY 10023",
      price: isFree ? "Free" : "See website",
      price_cents: isFree ? 0 : null,
      program: null,
      performers: null,
      source_url: e.link,
      tags,
    };
  });
}

export const juilliard: Source = {
  name: "Juilliard",
  url: "https://www.juilliard.edu/calendar",
  fetch: async () => "", // not used — directExtract handles everything
  directExtract,
};
