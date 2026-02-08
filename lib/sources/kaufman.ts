import * as cheerio from "cheerio";
import { Source } from "../types";

// Kaufman Music Center / Merkin Concert Hall
// Server-rendered calendar grid with events as <a> tags inside <div class="day entries">
// Each entry: <a id="entry-XXXXX" href="..." class="entry status-Featured">
//   <strong class="cat-mch">11 am</strong>
//   <span>Event Title</span>
// </a>
//
// NOTE: Kaufman's calendar sometimes shows the same events on multiple months
// with identical URLs. We deduplicate by URL to avoid ghost duplicates.

const SOURCE_URL = "https://www.kaufmanmusiccenter.org/mch/calendar/";

async function fetchAndClean(): Promise<string> {
  const pages: string[] = [];
  const seenUrls = new Set<string>();

  for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const url =
      monthOffset === 0
        ? SOURCE_URL
        : `${SOURCE_URL}?y=${year}&m=${month}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        console.warn(
          `Kaufman fetch failed for month ${month}: ${response.status}`
        );
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const monthName = date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      const events: string[] = [];

      // Each day with events is a <div class="day entries">
      $("div.day.entries").each((_, dayDiv) => {
        const $day = $(dayDiv);
        const dayNum = $day.find(".date").text().trim();

        $day.find("a.entry").each((_, entry) => {
          const $entry = $(entry);
          const time = $entry.find("strong").text().trim();
          const title = $entry.find("span").text().trim();
          const href = $entry.attr("href") || "";

          // Skip if we already saw this URL (Kaufman bug: same events on multiple months)
          if (href && seenUrls.has(href)) return;
          if (href) seenUrls.add(href);

          if (title) {
            events.push(
              `${monthName} ${dayNum}, ${time}: ${title}\nURL: ${href}`
            );
          }
        });
      });

      if (events.length > 0) {
        pages.push(`--- ${monthName} ---\n${events.join("\n\n")}`);
      }
    } catch (e) {
      console.warn(`Kaufman fetch error for month ${month}:`, e);
    }
  }

  const combined = pages.join("\n\n");
  return combined.slice(0, 30000);
}

export const kaufman: Source = {
  name: "Kaufman Music Center / Merkin Hall",
  url: SOURCE_URL,
  fetch: fetchAndClean,
};
