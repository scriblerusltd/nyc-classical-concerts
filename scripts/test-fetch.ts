/**
 * Test just the HTML fetching and cleaning — no Claude API needed.
 * Usage: npx tsx scripts/test-fetch.ts
 */

import { sources } from "../lib/sources";

async function main() {
  for (const source of sources) {
    console.log(`\n=== ${source.name} ===`);
    console.log(`URL: ${source.url}`);
    try {
      const html = await source.fetch();
      console.log(`Cleaned HTML length: ${html.length} characters`);
      console.log(`First 1000 chars:\n${html.slice(0, 1000)}`);
      console.log(`\nLast 500 chars:\n${html.slice(-500)}`);
    } catch (e) {
      console.error(`ERROR: ${e}`);
    }
    console.log("\n" + "=".repeat(60));
  }
}

main().catch(console.error);
