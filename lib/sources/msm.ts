import * as cheerio from "cheerio";
import { Source } from "../types";

// Manhattan School of Music — free student recitals and concerts
// Server-rendered at /performances/?date=Mon-YYYY
// ~30-40 events per month during academic year
// Almost all events are free and open to the public

const SOURCE_URL = "https://www.msmnyc.edu/performances/";

async function fetchAndClean(): Promise<string> {
  const pages: string[] = [];

  // Fetch current month and next 3 months
  for (let monthOffset = 0; monthOffset < 4; monthOffset++) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    const monthStr = date.toLocaleString("en-US", { month: "short" });
    const yearStr = date.getFullYear().toString();
    const dateParam = `${monthStr}-${yearStr}`;

    try {
      const url = `${SOURCE_URL}?date=${dateParam}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        console.warn(`MSM fetch failed for ${dateParam}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const events: string[] = [];

      // Each event is in the performance listing area
      $("article, .performance-item, .event-item, li").each((_, el) => {
        const $el = $(el);
        const timeText = $el.find("time").text().trim();
        const titleEl = $el.find("h2 a, h3 a, .title a").first();
        const title = titleEl.text().trim();
        let href = titleEl.attr("href");

        if (title && timeText) {
          if ($el.hasClass("inactive")) return;

          // Fix double-prefix URLs
          if (href) {
            if (href.startsWith("https://www.msmnyc.edu")) {
              // already absolute, keep as-is
            } else if (href.startsWith("/")) {
              href = `https://www.msmnyc.edu${href}`;
            }
          }

          events.push(
            [
              `Event: ${title}`,
              `Date/Time: ${timeText}`,
              href ? `URL: ${href}` : null,
              `Price: Free`,
            ]
              .filter(Boolean)
              .join("\n")
          );
        }
      });

      // Fallback: use time elements
      if (events.length === 0) {
        $("time").each((_, timeEl) => {
          const $time = $(timeEl);
          const timeText = $time.text().trim();
          const $parent = $time.closest("a, li, article, div");
          const titleEl = $parent.find("h2, h3, .title").first();
          const title = titleEl.length
            ? titleEl.text().trim()
            : $parent.text().trim().split("\n")[0];
          let href =
            $parent.find("a").attr("href") ||
            $parent.closest("a").attr("href");

          if (title && timeText && !title.includes("inactive")) {
            if (href && !href.startsWith("http")) {
              href = `https://www.msmnyc.edu${href.startsWith("/") ? href : `/${href}`}`;
            }

            events.push(
              [
                `Event: ${title.slice(0, 200)}`,
                `Date/Time: ${timeText}`,
                href ? `URL: ${href}` : null,
                `Price: Free`,
              ]
                .filter(Boolean)
                .join("\n")
            );
          }
        });
      }

      if (events.length > 0) {
        pages.push(
          `--- ${monthStr} ${yearStr} ---\n${events.join("\n\n")}`
        );
      }
    } catch (e) {
      console.warn(`MSM fetch error for ${dateParam}:`, e);
    }
  }

  return pages.join("\n\n").slice(0, 30000);
}

export const msm: Source = {
  name: "Manhattan School of Music",
  url: SOURCE_URL,
  fetch: fetchAndClean,
};
