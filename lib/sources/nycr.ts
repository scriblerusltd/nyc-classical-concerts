import * as cheerio from "cheerio";
import { Source } from "../types";

// New York Classical Review — comprehensive NYC classical calendar
// Structure: WordPress site, events in <p> tags under <h5.archive> date headers
// All server-rendered, single page with multiple months

const SOURCE_URL = "https://newyorkclassicalreview.com/category/calendar/";

async function fetchAndClean(): Promise<string> {
  const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`NYCR fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, sidebar, ads
  $(
    "script, style, link, meta, nav, footer, #col-right, #ad-col, #header, #navigation-box, #footer, .sidebar, .ad, iframe, noscript, img"
  ).remove();

  // Extract just the main content area with the calendar posts
  const mainContent = $("#col-main").html();

  if (!mainContent) {
    // Fallback: return body content
    return $("body").text().slice(0, 30000);
  }

  // Clean up the HTML to reduce token usage
  const $main = cheerio.load(mainContent);

  // Get text content with some structure preserved
  return $main.html()?.slice(0, 30000) || "";
}

export const nycr: Source = {
  name: "New York Classical Review",
  url: SOURCE_URL,
  fetch: fetchAndClean,
};
