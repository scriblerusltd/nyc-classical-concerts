import { NextRequest, NextResponse } from "next/server";
import { getConcerts } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") || undefined;
  const maxPrice = searchParams.get("maxPrice");
  const tags = searchParams.get("tags");
  const venue = searchParams.get("venue") || undefined;

  try {
    const concerts = await getConcerts({
      from,
      to,
      maxPriceCents: maxPrice ? parseInt(maxPrice, 10) : undefined,
      tags: tags ? tags.split(",") : undefined,
      venue,
    });

    return NextResponse.json(concerts);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
