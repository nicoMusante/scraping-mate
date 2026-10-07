import { searchSources } from "@/lib/mate-scraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pagination and WooCommerce detail pages need more time than one listing.
export const maxDuration = 300;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q");
  return Response.json(await searchSources(query), { headers: { "Cache-Control": "no-store" } });
}
