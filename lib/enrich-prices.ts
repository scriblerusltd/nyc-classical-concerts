import * as cheerio from "cheerio";
import { Concert } from "./types";

/**
 * Fetch individual event detail pages to find actual ticket prices.
 * Currently supports Kaufman/Merkin Hall (JSON-LD structured data).
 * Runs after initial extraction on concerts with "See website" price.
 */

const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;

interface PriceResult {
  price: string;
  price_cents: number | null;
}

async function fetchKaufmanPrice(url: string): Promise<PriceResult | null> {
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

    // Try JSON-LD first (most reliable)
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        const offers = data.offers || data[0]?.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer.price !== undefined) {
            const priceStr = String(offer.price);
            // Handle "40/45" format (two tiers)
            const firstPrice = priceStr.split("/")[0];
            const cents = Math.round(parseFloat(firstPrice) * 100);
            return {
              price: `$${priceStr}`,
              price_cents: isNaN(cents) ? null : cents,
            };
          }
        }
      } catch {
        // JSON parse failed, try HTML fallback
      }
    }

    // Fallback: ticket-bar element
    const ticketBar = $(".ticket-bar span")
      .filter((_, el) => $(el).text().includes("$"))
      .first()
      .text()
      .trim();

    if (ticketBar) {
      const match = ticketBar.match(/\$(\d+)/);
      if (match) {
        const cents = parseInt(match[1], 10) * 100;
        return { price: ticketBar, price_cents: cents };
      }
    }

    // Check for "free" indicators
    const bodyText = $("body").text().toLowerCase();
    if (
      bodyText.includes("free admission") ||
      bodyText.includes("free, no tickets") ||
      bodyText.includes("free event")
    ) {
      return { price: "Free", price_cents: 0 };
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

export async function enrichPrices(concerts: Concert[]): Promise<Concert[]> {
  // Find concerts that need price enrichment
  const needsPrice = concerts.filter(
    (c) =>
      c.price === "See website" &&
      c.source_url &&
      // Only enrich from sources where we know detail pages have prices
      (c.source_url.includes("kaufmanmusiccenter.org") ||
        c.source_url.includes("msmnyc.edu"))
  );

  if (needsPrice.length === 0) return concerts;

  console.log(`Enriching prices for ${needsPrice.length} concerts...`);

  const priceResults = await processInBatches(
    needsPrice,
    async (concert) => {
      let result: PriceResult | null = null;

      if (concert.source_url?.includes("kaufmanmusiccenter.org")) {
        result = await fetchKaufmanPrice(concert.source_url);
      } else if (concert.source_url?.includes("msmnyc.edu")) {
        // MSM detail pages sometimes have price info
        result = await fetchKaufmanPrice(concert.source_url); // same HTML parsing works
      }

      if (result) {
        console.log(`  ${concert.title}: ${result.price}`);
      }

      return { concertId: concert.id, result };
    },
    CONCURRENCY
  );

  // Apply prices
  const priceMap = new Map(
    priceResults
      .filter((r) => r.result !== null)
      .map((r) => [r.concertId, r.result!])
  );

  return concerts.map((c) => {
    const found = priceMap.get(c.id);
    if (found) {
      return {
        ...c,
        price: found.price,
        price_cents: found.price_cents,
        tags: found.price_cents === 0 && !c.tags.includes("free")
          ? [...c.tags, "free"]
          : found.price_cents !== null && found.price_cents <= 2000 && !c.tags.includes("cheap")
            ? [...c.tags, "cheap"]
            : c.tags,
      };
    }
    return c;
  });
}
