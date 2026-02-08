import * as cheerio from "cheerio";
import { Source } from "../types";

// Trinity Church NYC — free concerts including "Bach at One" and other music events
// Now at trinitychurchnyc.org (was trinitywallstreet.org)
// Well-structured Drupal site with BEM class names
// Filter to music events via URL parameter
// Paginated: 12 events per page

const SOURCE_URL =
  "https://trinitychurchnyc.org/events-search?event_type%5BMusic%5D=Music";
const MAX_PAGES = 3; // 3 pages × 12 events = up to 36 upcoming events

function extractEventsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, images, etc.
  $(
    "script, style, link, meta, nav, footer, header, iframe, noscript, img, svg, .view__filters-bar"
  ).remove();

  const events: string[] = [];

  $(".l-content-list").each((_, group) => {
    const dateHeader = $(group).find(".l-content-list__title").text().trim();

    $(group)
      .find("article.teaser-event-listing")
      .each((_, article) => {
        const $article = $(article);
        const time = $article
          .find(".teaser-event-listing__time")
          .text()
          .trim();
        const location = $article
          .find(".teaser-event-listing__location")
          .text()
          .trim();
        const title = $article
          .find(".teaser-event-listing__title a")
          .text()
          .trim();
        const href = $article
          .find(".teaser-event-listing__title a")
          .attr("href");
        const summary = $article
          .find(".teaser-event-listing__summary")
          .text()
          .trim();
        const tags: string[] = [];
        $article.find(".teaser-event-listing__tag li a").each((_, tag) => {
          tags.push($(tag).text().trim());
        });

        const calStart = $article
          .find(".add-to-calendar .start")
          .text()
          .trim();
        const calLocation = $article
          .find(".add-to-calendar .location")
          .text()
          .trim();

        const fullUrl = href
          ? `https://trinitychurchnyc.org${href}`
          : undefined;

        events.push(
          [
            `Event: ${title}`,
            `Date: ${dateHeader}`,
            time ? `Time: ${time}` : null,
            `Location: ${location || calLocation}`,
            fullUrl ? `URL: ${fullUrl}` : null,
            summary ? `Description: ${summary}` : null,
            tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
            calStart ? `Calendar Start: ${calStart}` : null,
            `Price: Free`,
          ]
            .filter(Boolean)
            .join("\n")
        );
      });
  });

  return events;
}

async function fetchAndClean(): Promise<string> {
  const allEvents: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = page === 0 ? SOURCE_URL : `${SOURCE_URL}&page=${page}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        console.warn(`Trinity page ${page} fetch failed: ${response.status}`);
        break;
      }

      const html = await response.text();
      const events = extractEventsFromHtml(html);

      if (events.length === 0) break; // No more events
      allEvents.push(...events);
    } catch (e) {
      console.warn(`Trinity page ${page} error:`, e);
      break;
    }
  }

  if (allEvents.length === 0) {
    return "";
  }

  return allEvents.join("\n\n").slice(0, 30000);
}

export const trinity: Source = {
  name: "Trinity Church NYC",
  url: SOURCE_URL,
  fetch: fetchAndClean,
};
