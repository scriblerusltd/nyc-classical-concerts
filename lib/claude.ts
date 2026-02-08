import Anthropic from "@anthropic-ai/sdk";
import { ExtractedConcert } from "./types";

const client = new Anthropic();

const EXTRACTION_PROMPT = `You are extracting classical music concert listings from a webpage.
The current date is {today}. Extract ONLY events happening in the future (today or later).

For each concert, extract:
- title: the concert/event title
- date: in ISO 8601 format (YYYY-MM-DDTHH:MM:SS). If only a date is given with no time, use T00:00:00. Include timezone offset for ET (-05:00 or -04:00 for DST) if you can determine the time.
- venue: the venue name
- address: full street address if available, otherwise null
- price: exact text — "Free", "$10", "Pay what you wish", etc. If not listed, use "See website"
- price_cents: integer — 0 for free, the dollar amount in cents for priced events, null if unclear
- program: composers and works as listed, or null
- performers: names and instruments/roles, or null
- source_url: the event's detail page URL if available (resolve relative URLs against the source base URL)
- tags: array from these options ONLY: "free", "cheap" (under $20), "student", "church", "chamber", "orchestral", "solo", "choral", "organ", "opera", "new-music", "family"

Return ONLY a JSON array of objects. No markdown formatting, no code blocks, no explanation.
If there are no future events, return an empty array: []
If a field is unavailable, use null.
Do not invent or guess information not present in the HTML.
If the source is a single venue (e.g. a school or church) and no venue is listed per event, use the source/organization name as the venue.

Source: {source_name}
Base URL: {source_url}

HTML content:
{html_content}`;

export async function extractConcerts(
  htmlContent: string,
  sourceName: string,
  sourceUrl: string
): Promise<ExtractedConcert[]> {
  const today = new Date().toISOString().split("T")[0];

  const prompt = EXTRACTION_PROMPT.replace("{today}", today)
    .replace("{source_name}", sourceName)
    .replace("{source_url}", sourceUrl)
    .replace("{html_content}", htmlContent);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse the JSON response — handle potential markdown code blocks
  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const concerts: ExtractedConcert[] = JSON.parse(jsonStr);

    if (!Array.isArray(concerts)) {
      console.error(
        `Claude returned non-array for ${sourceName}:`,
        jsonStr.slice(0, 200)
      );
      return [];
    }

    // Basic validation and cleanup
    return concerts
      .map((c) => ({
        ...c,
        // Default venue to source name if missing
        venue: c.venue || sourceName,
      }))
      .filter((c) => {
        if (!c.title || !c.date) {
          console.warn(
            `Skipping incomplete concert from ${sourceName}:`,
            c.title
          );
          return false;
        }
        return true;
      });
  } catch (e) {
    console.error(
      `Failed to parse Claude response for ${sourceName}:`,
      e,
      jsonStr.slice(0, 500)
    );
    return [];
  }
}
