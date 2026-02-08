import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Concert } from "./types";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to use the database"
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function upsertConcerts(concerts: Concert[]): Promise<void> {
  if (concerts.length === 0) return;

  const { error } = await getSupabase().from("concerts").upsert(concerts, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Failed to upsert concerts: ${error.message}`);
  }
}

export async function getConcerts(options: {
  from?: string;
  to?: string;
  maxPriceCents?: number;
  tags?: string[];
  venue?: string;
}): Promise<Concert[]> {
  let query = getSupabase()
    .from("concerts")
    .select("*")
    .order("date", { ascending: true });

  if (options.from) {
    query = query.gte("date", options.from);
  }
  if (options.to) {
    query = query.lte("date", options.to);
  }
  if (options.maxPriceCents !== undefined) {
    query = query.or(
      `price_cents.lte.${options.maxPriceCents},price_cents.is.null`
    );
  }
  if (options.venue) {
    query = query.ilike("venue", `%${options.venue}%`);
  }
  if (options.tags && options.tags.length > 0) {
    query = query.overlaps("tags", options.tags);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch concerts: ${error.message}`);
  }

  return data as Concert[];
}

export async function deleteOldConcerts(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { error } = await getSupabase()
    .from("concerts")
    .delete()
    .lt("date", yesterday.toISOString());

  if (error) {
    throw new Error(`Failed to delete old concerts: ${error.message}`);
  }
}

export async function deleteAllConcerts(): Promise<void> {
  const { error } = await getSupabase()
    .from("concerts")
    .delete()
    .gte("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(`Failed to delete all concerts: ${error.message}`);
  }
}
