import { NextResponse } from "next/server";
import { sources } from "@/lib/sources";
import { extractConcerts } from "@/lib/claude";
import { deduplicateConcerts } from "@/lib/dedup";
import { upsertConcerts, deleteOldConcerts } from "@/lib/db";
import { enrichPrices } from "@/lib/enrich-prices";

export const maxDuration = 60; // Allow up to 60s for the cron job

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`Starting concert aggregation at ${new Date().toISOString()}`);

  const results: {
    source_name: string;
    source_url: string;
    concerts: Awaited<ReturnType<typeof extractConcerts>>;
  }[] = [];
  const errors: { source: string; error: string }[] = [];

  // Fetch and extract from each source
  for (const source of sources) {
    try {
      let concerts;

      if (source.directExtract) {
        // Source provides structured data directly (e.g. Juilliard API)
        console.log(`Fetching ${source.name} (direct)...`);
        concerts = await source.directExtract();
      } else {
        // Source provides HTML for Claude extraction
        console.log(`Fetching ${source.name}...`);
        const html = await source.fetch();
        console.log(
          `Got ${html.length} chars from ${source.name}, sending to Claude...`
        );
        concerts = await extractConcerts(html, source.name, source.url);
      }

      console.log(`Extracted ${concerts.length} concerts from ${source.name}`);

      results.push({
        source_name: source.name,
        source_url: source.url,
        concerts,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`Error processing ${source.name}: ${errorMsg}`);
      errors.push({ source: source.name, error: errorMsg });
    }
  }

  // Deduplicate across all sources
  let dedupedConcerts = deduplicateConcerts(results);
  console.log(
    `Total: ${dedupedConcerts.length} concerts after deduplication`
  );

  // Enrich prices by fetching individual event pages
  try {
    dedupedConcerts = await enrichPrices(dedupedConcerts);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`Price enrichment error: ${errorMsg}`);
  }

  // Write to database
  try {
    await upsertConcerts(dedupedConcerts);
    await deleteOldConcerts();
    console.log("Successfully wrote concerts to database");
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`Database error: ${errorMsg}`);
    errors.push({ source: "database", error: errorMsg });
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    sources: results.map((r) => ({
      name: r.source_name,
      count: r.concerts.length,
    })),
    total: dedupedConcerts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
