export type Source = { store: string; url: string };
export type Product = { name: string; url: string; image?: string; price?: string; currency?: string; store: string };
export type SourceReport = {
  store: string; url: string; status: "complete" | "partial" | "error";
  pages: number; inspectedProducts: number; products: number; issues: string[];
};

export const sources: Source[] = [
  { store: "Yerbas Calzada", url: "https://yerbascalzada.com/search/?q=torpedo" },
  { store: "Unidos por un Mate", url: "https://www.unidosporunmate.com/search/?q=torpedo" },
  { store: "Arcano Mates", url: "https://arcanomates.com/search/?q=torpedo" },
  { store: "Mónaco Mates", url: "https://monacomates.com/search/?q=torpedo" },
  { store: "Deal Matera", url: "https://dealmatera2.mitiendanube.com/search/?q=torpedo" },
  { store: "Teko Mates", url: "https://tekomates.com.ar/search/?q=torpedo" },
  { store: "Matessn", url: "https://www.matessn.com/search/?q=torpedo" },
  { store: "Mate Style", url: "https://matesstyle.emprentienda.com.ar/?q=torpedo" },
  { store: "Estilo Austral", url: "https://estiloaustral.com/?s=torpedo&post_type=product" },
  { store: "Soraka", url: "https://www.soraka.com.ar/search/?q=torpedo" },
  { store: "Mates Bayres", url: "https://www.matesbayres.com.ar/search/?q=torpedo" },
  { store: "Mate Sur", url: "https://matesur.net/search/?q=torpedo" },
  { store: "Yerba Sip", url: "https://www.yerbasip.com/search/?q=torpedo" },
  { store: "Cala Mates", url: "https://calamates.com.ar/search/?q=torpedo" },
  { store: "Pa' Mate", url: "https://pamate.com.ar/search/?q=torpedo" },
  { store: "La Pampa Mates", url: "https://lapampamates.com/?s=torpedo&post_type=product" },
  { store: "Matermos", url: "https://www.matermos.com/search/?q=torpedo" },
];

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function scalar(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function decode(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;|&#8217;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, code: string) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return n <= 0x10ffff ? String.fromCodePoint(n) : match;
    });
}
function text(value: unknown): string { return decode(scalar(value)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function first(value: unknown): string {
  if (Array.isArray(value)) return first(value[0]);
  if (value && typeof value === "object") { const item = object(value); return first(item.url ?? item.contentUrl ?? item.thumbnailUrl ?? item["@id"]); }
  return scalar(value);
}
function absolute(value: string, base: string): string | undefined {
  try { const url = new URL(decode(value), base); return value && /^https?:$/.test(url.protocol) ? url.toString() : undefined; } catch { return undefined; }
}
function host(url: string): string { return new URL(url).hostname.replace(/^www\./, ""); }
export function productKey(url: string): string {
  const parsed = new URL(url);
  return `${host(url)}${parsed.pathname.replace(/\/$/, "")}`;
}
function isProductType(value: unknown): boolean {
  return list(value).some((type) => /^(?:https?:\/\/schema\.org\/)?Product$/i.test(scalar(type)));
}
function isTorpedo(name: string): boolean {
  return /\btorpedos?\b/i.test(name) && !/^(?:bombilla|funda|soporte|virola|base)\b/i.test(name);
}
function offers(record: RecordValue): RecordValue[] {
  return list(record.offers).flatMap((value) => {
    const offer = object(value);
    return offer.offers ? offers(offer) : [offer];
  });
}
function availability(offer: RecordValue): string {
  return scalar(offer.availability).split(/[\/#]/).pop()?.toLowerCase() ?? "";
}
function productUrl(record: RecordValue, base: string): string | undefined {
  return absolute(first(record.url) || first(offers(record)[0]?.url) || first(record.mainEntityOfPage), base);
}
export function extractRecords(html: string): { records: RecordValue[]; malformed: number } {
  const records: RecordValue[] = [];
  let malformed = 0;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = object(value);
    if (isProductType(item["@type"])) records.push(item);
    Object.values(item).forEach(visit);
  };
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try { visit(JSON.parse(script[2])); } catch { malformed++; }
  }
  return { records, malformed };
}
export function productsFromRecords(records: RecordValue[], source: Source): Product[] {
  const products: Product[] = [];
  for (const record of records) {
    const name = text(record.name);
    if (!isTorpedo(name)) continue;
    // A sold-out first variant must not hide another available variant.
    const offer = offers(record).find((item) => availability(item) === "instock");
    if (!offer) continue;
    const url = productUrl(record, source.url);
    if (!url || host(url) !== host(source.url)) continue;
    const priceSpec = object(list(offer.priceSpecification)[0]);
    products.push({ name, url, store: source.store, image: absolute(first(record.image), source.url),
      price: scalar(offer.price ?? priceSpec.price) || undefined,
      currency: scalar(offer.priceCurrency ?? priceSpec.priceCurrency) || undefined });
  }
  return products;
}
type Link = { url: string; label: string; attributes: string };
function links(html: string, base: string): Link[] {
  const found: Link[] = [];
  for (const anchor of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = href && absolute(href, base);
    if (url && host(url) === host(base)) found.push({ url, label: text(anchor[2]), attributes: anchor[1] });
  }
  return found;
}
function productLinks(pageLinks: Link[]): string[] {
  return [...new Set(pageLinks.filter((item) => /\/(?:productos?|product)\//i.test(new URL(item.url).pathname)
    && /torpedo/i.test(`${new URL(item.url).pathname} ${item.label}`)).map((item) => item.url))];
}
function paginationLinks(pageLinks: Link[], base: string): string[] {
  const current = new URL(base);
  const path = current.pathname.replace(/\/page\/\d+\/?$/, "/");
  return [...new Set(pageLinks.filter((item) => {
    const url = new URL(item.url);
    url.hash = "";
    const currentPage = new URL(base);
    currentPage.hash = "";
    if (url.toString() === currentPage.toString()) return false;
    const sameListing = url.pathname.replace(/\/page\/\d+\/?$/, "/") === path;
    return sameListing && (/\brel\s*=\s*["']next["']/i.test(item.attributes)
      || url.searchParams.has("page") || url.searchParams.has("paged") || /\/page\/\d+\/?$/.test(url.pathname));
  }).map((item) => { const url = new URL(item.url); url.hash = ""; return url.toString(); }))];
}

export async function withLimit<T, R>(items: T[], limit: number, action: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await action(items[index]); }
  }));
  return results;
}

type LoadedPage = { html: string; url: string };
type LoadPage = (url: string) => Promise<LoadedPage>;
async function loadPage(url: string): Promise<LoadedPage> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store",
    headers: { "User-Agent": "MateFinder/1.0 (catalog search)", Accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (/<title[^>]*>[^<]*(?:Just a moment|Access denied|Attention Required)/i.test(html)) throw new Error("La tienda bloqueó la consulta");
  return { html, url: response.url || url };
}

export async function inspect(source: Source, load: LoadPage = loadPage, budgetMs = 240_000) {
  const report: SourceReport = { ...source, status: "complete", pages: 0, inspectedProducts: 0, products: 0, issues: [] };
  const products = new Map<string, Product>();
  const inspected = new Set<string>();
  const details = new Set<string>();
  const visited = new Set<string>();
  const pending = [{ url: source.url, root: source.url }];
  const listings = new Map<string, { inspected: Set<string>; expectedTotal?: number; infinite: boolean }>();
  listings.set(source.url, { inspected: new Set(), infinite: false });
  const deadline = Date.now() + budgetMs;
  const issue = (message: string) => { if (!report.issues.includes(message)) report.issues.push(message); };
  while (pending.length) {
    if (Date.now() > deadline || visited.size >= 100) { issue("La revisión alcanzó el límite de tiempo o páginas; quedan publicaciones sin revisar."); break; }
    const { url: requested, root } = pending.shift()!;
    const listing = listings.get(root)!;
    if (visited.has(requested)) continue;
    visited.add(requested);
    try {
      const { html, url } = await load(requested);
      report.pages++;
      const parsed = extractRecords(html);
      if (parsed.malformed) issue("La tienda publicó datos de productos que no se pudieron leer.");
      const pageLinks = links(html, url);
      const candidates = productLinks(pageLinks);
      const previousCount = listing.inspected.size;
      for (const record of parsed.records) {
        const original = productUrl(record, url);
        if (original) { inspected.add(productKey(original)); listing.inspected.add(productKey(original)); }
        else if (isTorpedo(text(record.name))) issue("Algunas publicaciones no informan el enlace original del producto.");
        if (original && isTorpedo(text(record.name)) && !offers(record).some((offer) => availability(offer))) details.add(original);
      }
      for (const product of productsFromRecords(parsed.records, { ...source, url })) products.set(productKey(product.url), product);
      for (const candidate of candidates) {
        if (!inspected.has(productKey(candidate))) details.add(candidate);
        inspected.add(productKey(candidate));
        listing.inspected.add(productKey(candidate));
      }
      // Search indexes and category lists can differ. Compare both when the
      // store links to a torpedo category, deduplicating the original products.
      for (const link of pageLinks) {
        const category = new URL(link.url);
        if (!/\/(?:mates-)?torpedos?\/?$/i.test(category.pathname) || /\/(?:productos?|product)\//i.test(category.pathname)) continue;
        category.search = ""; category.hash = "";
        const categoryUrl = category.toString();
        if (!listings.has(categoryUrl)) {
          listings.set(categoryUrl, { inspected: new Set(), infinite: false });
          pending.push({ url: categoryUrl, root: categoryUrl });
        }
      }
      const total = html.match(/LS\.productsCount\s*=\s*(\d+)/)?.[1];
      if (total) listing.expectedTotal = Number(total);
      const next = paginationLinks(pageLinks, url).filter((link) => !visited.has(link));
      pending.push(...next.filter((link) => !pending.some((entry) => entry.url === link)).map((link) => ({ url: link, root })));
      const infiniteScroll = /class\s*=\s*["'][^"']*\bjs-load-more\b/i.test(html);
      // Tiendanube returns fragments on page 2+, without the load-more button.
      // Continue the stream until it returns no new products, not just page 2.
      listing.infinite ||= infiniteScroll;
      const needsMore = listing.expectedTotal === undefined ? listing.infinite : listing.inspected.size < listing.expectedTotal;
      if (!next.length && needsMore) {
        if (listing.inspected.size > previousCount) {
          const nextPage = new URL(url);
          nextPage.searchParams.set("page", String(Number(nextPage.searchParams.get("page") || "1") + 1));
          if (!visited.has(nextPage.toString()) && !pending.some((entry) => entry.url === nextPage.toString())) pending.push({ url: nextPage.toString(), root });
        } else if (listing.expectedTotal !== undefined && listing.inspected.size < listing.expectedTotal) {
          issue(`La tienda indica ${listing.expectedTotal} publicaciones, pero sólo se pudieron recorrer ${listing.inspected.size}.`);
        } else if (parsed.records.length || candidates.length) {
          issue("La paginación repitió publicaciones; no se pudo comprobar el final del catálogo.");
        }
      }
      if (!parsed.records.length && !candidates.length && !(listing.infinite && requested !== root) && !/no (?:encontramos|hay|se encontraron)\s+(?:productos|resultados|coincidencias)|sin resultados|0 productos/i.test(text(html)) && !infiniteScroll) {
        issue("No se pudo leer el catálogo de esta página.");
      }
    } catch (error) { issue(error instanceof Error ? error.message : "No se pudo consultar la tienda"); }
  }
  // Detail pages are read sequentially; three stores run concurrently at most.
  for (const url of details) {
    if (Date.now() > deadline) { issue("Quedaron fichas de productos sin revisar por el límite de tiempo."); break; }
    try {
      const page = await load(url);
      const parsed = extractRecords(page.html);
      const matching = parsed.records.filter((record) => {
        const original = productUrl(record, page.url);
        return original && productKey(original) === productKey(url);
      });
      if (!matching.length || matching.some((record) => !offers(record).some((offer) => availability(offer)))) {
        issue("Algunas fichas no informan datos o disponibilidad verificable.");
      }
      for (const product of productsFromRecords(matching, { ...source, url: page.url })) products.set(productKey(product.url), product);
    } catch (error) { issue(`Ficha de producto: ${error instanceof Error ? error.message : "consulta fallida"}`); }
  }
  report.inspectedProducts = inspected.size;
  report.products = products.size;
  report.status = report.issues.length ? report.pages ? "partial" : "error" : "complete";
  return { products: [...products.values()], report };
}

export async function searchSources(selected = sources) {
  const deadline = Date.now() + 240_000;
  const results = await withLimit(selected, 3, (source) => inspect(source, undefined, Math.max(0, deadline - Date.now())));
  const unique = new Map<string, Product>();
  for (const result of results) for (const product of result.products) unique.set(productKey(product.url), product);
  const products = [...unique.values()].sort((a, b) => Number(Boolean(b.price)) - Number(Boolean(a.price)) || a.store.localeCompare(b.store));
  const reports = results.map((result) => result.report);
  return { products, sources: reports, totalSources: selected.length,
    checkedSources: reports.filter((report) => report.pages > 0).length,
    completeSources: reports.filter((report) => report.status === "complete").length,
    errors: reports.filter((report) => report.status !== "complete").map((report) => `${report.store}: ${report.issues.join("; ")}`),
    updatedAt: new Date().toISOString() };
}
