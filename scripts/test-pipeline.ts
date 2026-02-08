/**
 * Test script to run the data pipeline locally.
 * Usage: npx tsx scripts/test-pipeline.ts
 *
 * Requires ANTHROPIC_API_KEY in .env.local or environment.
 * Skips database writes — just fetches, extracts, and prints results.
 */

// Load env vars BEFORE any other imports (dynamic imports below)
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic imports so dotenv runs first
  const { sources } = await import("../lib/sources");
  const { extractConcerts } = await import("../lib/claude");
  const { deduplicateConcerts } = await import("../lib/dedup");

  console.log("=== NYC Classical Concert Pipeline Test ===\n");

  const results: {
    source_name: string;
    source_url: string;
    concerts: Awaited<ReturnType<typeof extractConcerts>>;
  }[] = [];

  for (const source of sources) {
    console.log(`--- ${source.name} ---`);
    try {
      let concerts;

      if (source.directExtract) {
        console.log(`Fetching ${source.url} (direct API)...`);
        concerts = await source.directExtract();
      } else {
        console.log(`Fetching ${source.url}...`);
        const html = await source.fetch();
        console.log(`Got ${html.length} characters of cleaned HTML`);
        console.log(`Preview: ${html.slice(0, 300)}...\n`);

        console.log("Sending to Claude for extraction...");
        concerts = await extractConcerts(html, source.name, source.url);
      }

      console.log(`Extracted ${concerts.length} concerts:\n`);

      for (const c of concerts.slice(0, 5)) {
        console.log(`  ${c.date} | ${c.title}`);
        console.log(`    Venue: ${c.venue}`);
        console.log(`    Price: ${c.price} (${c.price_cents}¢)`);
        if (c.program) console.log(`    Program: ${c.program}`);
        if (c.performers) console.log(`    Performers: ${c.performers}`);
        if (c.tags.length) console.log(`    Tags: ${c.tags.join(", ")}`);
        console.log();
      }
      if (concerts.length > 5) {
        console.log(`  ... and ${concerts.length - 5} more\n`);
      }

      results.push({
        source_name: source.name,
        source_url: source.url,
        concerts,
      });
    } catch (e) {
      console.error(`ERROR: ${e}`);
    }
    console.log();
  }

  // Deduplicate
  let deduped = deduplicateConcerts(results);

  // Enrich prices from detail pages
  const { enrichPrices } = await import("../lib/enrich-prices");
  deduped = await enrichPrices(deduped);
  console.log(`\n=== TOTALS ===`);
  for (const r of results) {
    console.log(`  ${r.source_name}: ${r.concerts.length} concerts`);
  }
  console.log(
    `  Raw total: ${results.reduce((sum, r) => sum + r.concerts.length, 0)}`
  );
  console.log(`  After dedup: ${deduped.length}`);

  // Write to a local JSON file for inspection
  const { writeFileSync } = await import("fs");
  writeFileSync("test-output.json", JSON.stringify(deduped, null, 2));
  // Also copy to public for frontend
  writeFileSync("public/concerts.json", JSON.stringify(deduped, null, 2));
  console.log(`\nOutput written to test-output.json and public/concerts.json`);
}

main().catch(console.error);
