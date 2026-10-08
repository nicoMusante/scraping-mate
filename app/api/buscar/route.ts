import { normalizeSearchQuery, searchSources } from "@/lib/mate-scraper";
import { getCachedSearch, SEARCH_CACHE_TTL_MS, saveCachedSearch } from "@/lib/search-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pagination and WooCommerce detail pages need more time than one listing.
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeSearchQuery(url.searchParams.get("q"));
  const refresh = url.searchParams.get("refresh") === "1";
  const cached = await getCachedSearch(query);
  const checkedAt = cached ? new Date(cached.last_checked_at).getTime() : 0;

  if (!refresh && cached && Number.isFinite(checkedAt) && Date.now() - checkedAt < SEARCH_CACHE_TTL_MS) {
    return Response.json({ ...cached.response, cache: { state: "cached", checkedAt: cached.last_checked_at } }, { headers: { "Cache-Control": "no-store" } });
  }

  const response = await searchSources(query);
  const saved = await saveCachedSearch(query, response, cached);
  return Response.json({ ...response, cache: { state: saved.enabled ? "updated" : "live", changed: saved.changed, checkedAt: response.updatedAt } }, { headers: { "Cache-Control": "no-store" } });
}
