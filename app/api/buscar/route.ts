type Source = { store: string; url: string };
type Product = { name: string; url: string; image?: string; price?: string; currency?: string; store: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sources: Source[] = [
  { store: "Yerbas Calzada", url: "https://yerbascalzada.com/?s=torpedo&post_type=product" },
  { store: "Unidos por un Mate", url: "https://unidosporunmate.com/?s=torpedo&post_type=product" },
  { store: "Arcano Mates", url: "https://arcanomates.com/?s=torpedo&post_type=product" },
  { store: "Mónaco Mates", url: "https://monacomates.com/?s=torpedo&post_type=product" },
  { store: "Deal Matera", url: "https://dealmatera2.mitiendanube.com/?q=torpedo" },
  { store: "Teko Mates", url: "https://tekomates.com.ar/?s=torpedo&post_type=product" },
  { store: "Matessn", url: "https://www.matessn.com/mates/" },
  { store: "Mate Style", url: "https://matesstyle.emprentienda.com.ar/?q=torpedo" },
  { store: "Estilo Austral", url: "https://estiloaustral.com/?s=torpedo&post_type=product" },
  { store: "Soraka", url: "https://www.soraka.com.ar/?s=torpedo&post_type=product" },
  { store: "Mates Bayres", url: "https://www.matesbayres.com.ar/mates/torpedos/" },
  { store: "Mate Sur", url: "https://matesur.net/?s=torpedo&post_type=product" },
  { store: "Yerba Sip", url: "https://www.yerbasip.com/?s=torpedo&post_type=product" },
  { store: "Cala Mates", url: "https://calamates.com.ar/?s=torpedo&post_type=product" },
  { store: "Pa' Mate", url: "https://pamate.com.ar/?s=torpedo&post_type=product" },
  { store: "La Pampa Mates", url: "https://lapampamates.com/product-category/mates/" },
  { store: "Matermos", url: "https://matermos.com/mates/torpedo/" },
];

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#8217;/g, "'").replace(/\s+/g, " ").trim() : "";
}

function first(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return first(value[0]);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return first(item.url ?? item.contentUrl ?? item.thumbnailUrl);
  }
}

function absolute(value: string | undefined, base: string) {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
}

function productsFromJsonLd(value: unknown, source: Source): Product[] {
  const found: Product[] = [];
  const visit = (item: unknown) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    const name = text(record.name);
    const description = text(record.description);
    const haystack = `${name} ${description}`.toLocaleLowerCase("es-AR");
    if (types.some((type) => String(type).toLowerCase() === "product") && haystack.includes("torpedo") && haystack.includes("calabaza")) {
      const offer = Array.isArray(record.offers) ? record.offers[0] : record.offers;
      const details = offer && typeof offer === "object" ? offer as Record<string, unknown> : {};
      const availability = String(details.availability ?? "").toLowerCase();
      if (availability.includes("outofstock") || availability.includes("soldout") || availability.includes("agotado") || !availability.includes("instock")) return;
      const url = absolute(text(record.url) || text(details.url), source.url);
      if (url) found.push({ name, url, image: absolute(first(record.image), source.url), price: text(details.price), currency: text(details.priceCurrency), store: source.store });
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return found;
}

function extractJsonLd(html: string, source: Source) {
  const products: Product[] = [];
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try { products.push(...productsFromJsonLd(JSON.parse(script[1]), source)); } catch { /* malformed schema is skipped */ }
  }
  return products;
}

async function inspect(source: Source): Promise<Product[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(source.url, { signal: controller.signal, headers: { "User-Agent": "MateFinder/1.0 (catalog search)", "Accept": "text/html,application/xhtml+xml" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return extractJsonLd(await response.text(), source).slice(0, 20);
  } finally { clearTimeout(timer); }
}

async function withLimit<T, R>(items: T[], limit: number, action: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = [];
  let cursor = 0;
  const worker = async () => { while (cursor < items.length) { const item = items[cursor++]; try { results.push({ status: "fulfilled", value: await action(item) }); } catch (reason) { results.push({ status: "rejected", reason }); } } };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function GET() {
  const inspected = await withLimit(sources, 3, inspect);
  const errors = inspected.filter((item) => item.status === "rejected").map((item) => item.status === "rejected" ? String(item.reason) : "");
  const unique = new Map<string, Product>();
  for (const result of inspected) if (result.status === "fulfilled") for (const product of result.value) unique.set(product.url, product);
  const products = [...unique.values()].sort((a, b) => Number(Boolean(b.price)) - Number(Boolean(a.price)) || a.store.localeCompare(b.store));
  return Response.json({ products, checkedSources: sources.length - errors.length, errors, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
