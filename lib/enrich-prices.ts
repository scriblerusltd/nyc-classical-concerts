import * as cheerio from "cheerio";
import { Concert } from "./types";

/**
 * Enrich concerts with price and ticket data from venue detail pages.
 * Currently supports Kaufman/Merkin Hall (JSON-LD structured data + ticket links).
 * Runs after dedup on concerts with "See website" price or missing ticket URLs.
 */

const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;

interface EnrichResult {
  price?: string;
  price_cents?: number | null;
  ticket_url?: string;
}

async function fetchKaufmanDetails(url: string): Promise<EnrichResult | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const result: EnrichResult = {};

    // Extract ticket URL
    const ticketLink = $('a[href*="tickets.kaufmanmusiccenter.org"]').first().attr("href");
    if (ticketLink) {
      result.ticket_url = ticketLink;
    }

    // Try JSON-LD for price
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        const offers = data.offers || data[0]?.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer.price !== undefined) {
            const priceStr = String(offer.price);
            const firstPrice = priceStr.split("/")[0];
            const cents = Math.round(parseFloat(firstPrice) * 100);
            result.price = `$${priceStr}`;
            result.price_cents = isNaN(cents) ? null : cents;
          }

          // Also check for ticket URL in offers
          if (!result.ticket_url && offer.url) {
            result.ticket_url = offer.url;
          }
        }
      } catch {
        // JSON parse failed, try HTML fallback
      }
    }

    // Fallback: ticket-bar element for price
    if (!result.price) {
      const ticketBar = $(".ticket-bar span")
        .filter((_, el) => $(el).text().includes("$"))
        .first()
        .text()
        .trim();

      if (ticketBar) {
        const match = ticketBar.match(/\$(\d+)/);
        if (match) {
          result.price = ticketBar;
          result.price_cents = parseInt(match[1], 10) * 100;
        }
      }
    }

    // Check for "free" indicators
    if (!result.price) {
      const bodyText = $("body").text().toLowerCase();
      if (
        bodyText.includes("free admission") ||
        bodyText.includes("free, no tickets") ||
        bodyText.includes("free event")
      ) {
        result.price = "Free";
        result.price_cents = 0;
      }
    }

    // Only return if we found something useful
    if (result.price || result.ticket_url) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

async function processInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function enrichConcerts(concerts: Concert[]): Promise<Concert[]> {
  // Find concerts that need enrichment (price or ticket URL)
  const needsEnrichment = concerts.filter(
    (c) =>
      c.source_url &&
      (c.source_url.includes("kaufmanmusiccenter.org") ||
        c.source_url.includes("msmnyc.edu")) &&
      (c.price === "See website" || !c.ticket_url)
  );

  if (needsEnrichment.length === 0) return concerts;

  console.log(`Enriching ${needsEnrichment.length} concerts from detail pages...`);

  const enrichResults = await processInBatches(
    needsEnrichment,
    async (concert) => {
      let result: EnrichResult | null = null;

      if (concert.source_url?.includes("kaufmanmusiccenter.org")) {
        result = await fetchKaufmanDetails(concert.source_url);
      } else if (concert.source_url?.includes("msmnyc.edu")) {
        result = await fetchKaufmanDetails(concert.source_url); // same HTML parsing works
      }

      if (result) {
        const parts = [];
        if (result.price) parts.push(result.price);
        if (result.ticket_url) parts.push("ticket link");
        console.log(`  ${concert.title}: ${parts.join(", ")}`);
      }

      return { concertId: concert.id, result };
    },
    CONCURRENCY
  );

  // Apply enrichment
  const enrichMap = new Map(
    enrichResults
      .filter((r) => r.result !== null)
      .map((r) => [r.concertId, r.result!])
  );

  return concerts.map((c) => {
    const found = enrichMap.get(c.id);
    if (!found) return c;

    const updated = { ...c };

    if (found.price && c.price === "See website") {
      updated.price = found.price;
      updated.price_cents = found.price_cents ?? null;

      // Update tags based on price
      if (found.price_cents === 0 && !c.tags.includes("free")) {
        updated.tags = [...c.tags, "free"];
      } else if (found.price_cents !== null && found.price_cents !== undefined && found.price_cents <= 2000 && !c.tags.includes("cheap")) {
        updated.tags = [...c.tags, "cheap"];
      }
    }

    if (found.ticket_url && !c.ticket_url) {
      updated.ticket_url = found.ticket_url;
    }

    return updated;
  });
}

// Keep old name as alias for backwards compatibility with cron route
export const enrichPrices = enrichConcerts;
