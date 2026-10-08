import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type SearchCacheResponse = {
  query: string;
  products: unknown[];
  sources: unknown[];
  totalSources: number;
  checkedSources: number;
  completeSources: number;
  errors: string[];
  updatedAt: string;
};

type CacheRow = {
  response: SearchCacheResponse;
  content_hash: string;
  last_checked_at: string;
  updated_at: string;
};

export const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;

function cacheClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return undefined;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function isSearchResponse(value: unknown): value is SearchCacheResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return typeof response.query === "string" && Array.isArray(response.products) && Array.isArray(response.sources)
    && typeof response.totalSources === "number" && typeof response.checkedSources === "number"
    && typeof response.completeSources === "number" && Array.isArray(response.errors) && typeof response.updatedAt === "string";
}

export function searchContentHash(response: SearchCacheResponse) {
  const { updatedAt: _updatedAt, ...content } = response;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export async function getCachedSearch(query: string) {
  const client = cacheClient();
  if (!client) return undefined;
  const { data, error } = await client.from("search_cache")
    .select("response, content_hash, last_checked_at, updated_at").eq("query", query).maybeSingle();
  if (error || !data || !isSearchResponse(data.response)) return undefined;
  return data as CacheRow;
}

export async function saveCachedSearch(query: string, response: SearchCacheResponse, previous?: CacheRow) {
  const client = cacheClient();
  if (!client) return { enabled: false, changed: false };
  const now = new Date().toISOString();
  const contentHash = searchContentHash(response);
  const changed = previous?.content_hash !== contentHash;
  const { error } = changed
    ? await client.from("search_cache").upsert({ query, response, content_hash: contentHash, last_checked_at: now, updated_at: now })
    : await client.from("search_cache").update({ last_checked_at: now }).eq("query", query);
  return { enabled: !error, changed: !error && changed };
}
