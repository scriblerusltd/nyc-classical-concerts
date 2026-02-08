/**
 * Seed Supabase with concert data from test-output.json
 * Usage: npx tsx scripts/seed-supabase.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { upsertConcerts } = await import("../lib/db");
  const { readFileSync } = await import("fs");

  const data = JSON.parse(readFileSync("test-output.json", "utf-8"));
  console.log(`Seeding ${data.length} concerts to Supabase...`);

  // Upsert in batches of 50
  for (let i = 0; i < data.length; i += 50) {
    const batch = data.slice(i, i + 50);
    await upsertConcerts(batch);
    console.log(`  Upserted ${Math.min(i + 50, data.length)}/${data.length}`);
  }

  console.log("Done!");
}

main().catch(console.error);
