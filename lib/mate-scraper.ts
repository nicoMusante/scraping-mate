import { load as loadHtml } from "cheerio";

export type Source = { store: string; url: string };
export type Product = { name: string; url: string; image?: string; price?: string; transferPrice?: string; priceFrom?: boolean; currency?: string; store: string };
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
  { store: "Pipe Mates", url: "https://www.pipemates.com.ar/?s=torpedo&post_type=product" },
  { store: "Negro Mates", url: "https://negromates.empretienda.com.ar/?q=torpedo" },
  { store: "Mates Beltrán", url: "https://matesbeltran.com.ar/?q=torpedo" },
  { store: "Gancho Mates", url: "https://www.ganchomates.com.ar/?q=torpedo" },
  { store: "Matienzo Mates", url: "https://matienzomates.com.ar/?s=torpedo&post_type=product" },
  { store: "Mamate Mates", url: "https://mamatemates.mitiendanube.com/search/?q=torpedo" },
  { store: "La Ronda Mates", url: "https://larondamates.com/?s=torpedo&post_type=product" },
  { store: "Mates del Sur", url: "https://www.matesdelsur.com.ar/search/?q=torpedo" },
  { store: "Mates El Noble", url: "https://mateselnoble.com.ar/search/?q=torpedo" },
  { store: "Amor de Mates", url: "https://www.amordemates.ar/?s=torpedo&post_type=product" },
  { store: "Cébalo Amargo", url: "https://cebaloamargo.empretienda.com.ar/?q=torpedo" },
  { store: "CZ Mates", url: "https://czmates.empretienda.com.ar/?q=torpedo" },
  { store: "Mate Charrúa", url: "https://matecharrua.empretienda.com.ar/?q=torpedo" },
  { store: "Mates YCH", url: "https://matesych.mitiendanube.com/search/?q=torpedo" },
  { store: "Mateistas", url: "https://mateistas.mitiendanube.com/search/?q=torpedo" },
];

export function normalizeSearchQuery(value?: string | null): string {
  const normalized = (value ?? "torpedo").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return (normalized || "torpedo").slice(0, 60);
}

function matchesSearch(value: string, query: string): boolean {
  const haystack = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR");
  return normalizeSearchQuery(query).split(" ").every((term) => haystack.includes(term));
}

export function sourcesForQuery(query?: string | null): Source[] {
  const term = normalizeSearchQuery(query);
  return sources.map((source) => {
    const url = new URL(source.url);
    url.searchParams.set(url.searchParams.has("s") ? "s" : "q", term);
    return { ...source, url: url.toString() };
  });
}

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
export function isSingleMate(name: string, description = "", query = "torpedo"): boolean {
  const title = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const accessory = "(?:bombill\\w*|termos?|materas?|yerberas?)";
  const bundled = [...description.matchAll(new RegExp(`\\b(?:incluye|incluidos?|conjunto de|acompañado de)\\b[^.!\\n]{0,100}\\b${accessory}\\b`, "gi"))]
    .some((match) => !/\b(?:no(?:\s+se)?|sin)\s*$/i.test(description.slice(Math.max(0, match.index! - 16), match.index))
      && !new RegExp(`\\b(?:no|sin)\\s+(?:una?\\s+)?${accessory}\\b`, "i").test(match[0]));
  return matchesSearch(title, query)
    && !/^(?:bombilla|funda|soporte|virola|base)\b/i.test(title)
    && !/\b(?:combos?|kits?|sets?|packs?|box|bombill\w*|termos?|materas?|yerber\w*|azucarer\w*|canastas?)\b/i.test(title)
    && !/\bpico\s+(?:de\s+)?loro\b/i.test(title)
    && !/\b(?:[2-9]\s*[x×]\s*[1-9]|[x×]\s*[2-9])\b/i.test(title)
    && !bundled;
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
export function productsFromRecords(records: RecordValue[], source: Source, query = "torpedo"): Product[] {
  const products: Product[] = [];
  for (const record of records) {
    const name = text(record.name);
    if (!isSingleMate(name, text(record.description), query)) continue;
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

function money(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^\d.,]/g, "");
  const normalized = digits.includes(",") ? digits.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(digits) ? digits.replace(/\./g, "") : digits;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}
function cents(value: string | undefined): number | undefined {
  const amount = Number(value);
  return value && Number.isFinite(amount) && amount > 0 ? amount / 100 : undefined;
}
function transferRate(message: string): number | undefined {
  // Never apply a conditional, maximum, tax or coupon discount as a cash price.
  if (/hasta|a partir|minim|mínim|superior|cup[oó]n|no acumul|seleccionad|exclusiv|excepto|primer[ao]|s[oó]lo|[uú]nicamente|compras|pedidos/i.test(message)) return undefined;
  const rate = message.match(/\b(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:descuento|off)\s*(?:pagando\s+)?(?:por|con|en)\s+(?:pago\s+por\s+)?transferencia(?:\s+bancaria)?\b/i)?.[1];
  const percentage = Number(rate?.replace(",", "."));
  return percentage > 0 && percentage < 100 ? percentage : undefined;
}
export function pricesFromHtml(html: string, products: Product[], base: string): Product[] {
  if (!products.length) return products;
  const $ = loadHtml(html);
  const cards = new Map<string, ReturnType<typeof $>>();
  $(".js-product-container").each((_, element) => {
    const card = $(element);
    const href = card.find('a[href*="/productos/"], a[href*="/producto/"], a[href*="/product/"]').first().attr("href");
    const url = href && absolute(href, base);
    if (url) cards.set(productKey(url), card);
  });
  const globalRates = new Set<number>();
  $(".et-campaign, .js-adbar-message, .js-adbar-primary-message-container, .js-informative-banner-title").each((_, element) => {
    const node = $(element);
    const rate = transferRate(node.hasClass("js-informative-banner-title") ? node.parent().text() : node.text());
    if (rate) globalRates.add(rate);
  });
  const globalRate = globalRates.size === 1 ? [...globalRates][0] : undefined;
  return products.map((original) => {
    const product = { ...original };
    const card = cards.get(productKey(product.url));
    // On detail pages, restrict prices to the main product form or summary.
    const scope = card ?? (productKey(base) === productKey(product.url) ? $("#single-product, .summary, [data-store^='product-form-']").first() : undefined);
    let regular = money(product.price);
    let transfer: number | undefined;
    if (scope?.length) {
      const displayed = scope.find(".js-price-display").first();
      regular = cents(displayed.attr("data-product-price")) ?? money(displayed.text()) ?? regular;
      const method = scope.find(".js-payment-discount-name-product").first().text();
      if (/transferencia/i.test(method)) {
        const discount = scope.find(".js-payment-discount-price-product").first();
        transfer = cents(discount.attr("data-priceraw-without-shipping")) ?? money(discount.text());
      }
      const variantsData = scope.attr("data-variants") ?? scope.find("[data-variants]").first().attr("data-variants");
      if (variantsData) {
        try {
          const available = list(JSON.parse(variantsData)).map(object).filter((variant) => variant.available === true && variant.is_visible !== false && (variant.stock == null || Number(variant.stock) > 0) && variant.contact !== true);
          const priced = available.filter((variant) => money(scalar(variant.price_number))).sort((a, b) => Number(a.price_number) - Number(b.price_number));
          if (priced.length) {
            const discounted = /transferencia/i.test(method) ? priced.filter((variant) => {
              const amount = money(scalar(variant.price_with_payment_discount_short));
              return amount !== undefined && amount < Number(variant.price_number);
            }).sort((a, b) => money(scalar(a.price_with_payment_discount_short))! - money(scalar(b.price_with_payment_discount_short))!) : [];
            const variant = discounted[0] ?? priced[0];
            regular = Number(variant.price_number);
            // Do not reuse the displayed discount of a different/sold-out variant.
            transfer = /transferencia/i.test(method) ? money(scalar(variant.price_with_payment_discount_short)) : undefined;
            product.priceFrom = new Set(priced.map((item) => Number(item.price_number))).size > 1 || new Set(discounted.map((item) => item.price_with_payment_discount_short)).size > 1;
          } else { transfer = undefined; }
        } catch { transfer = undefined; }
      }
      if (transfer === undefined && productKey(base) === productKey(product.url)) {
        scope.find("p, .transfer-price, .bank-transfer-price").each((_, element) => {
          const message = $(element).text();
          if (/transferencia/i.test(message) && !/hasta|mínim|minim|superior|cuotas|cup[oó]n/i.test(message)) {
            const amounts = [...message.matchAll(/\$\s*[\d.]+(?:,\d{1,2})?/g)];
            const amount = amounts.length === 1 ? amounts[0][0]
              : message.match(/transferencia(?:\s+bancaria)?\s*[:—-]?\s*(?:ARS\s*)?(\$\s*[\d.]+(?:,\d{1,2})?)/i)?.[1]
                ?? message.match(/(\$\s*[\d.]+(?:,\d{1,2})?)\s*(?:pagando\s+)?(?:con|por|en)\s+transferencia/i)?.[1];
            if (amount) transfer = money(amount);
            else if (regular) {
              const rate = transferRate(message);
              if (rate) transfer = Math.round(regular * (100 - rate)) / 100;
            }
          }
        });
      }
    }
    if (regular) {
      product.price = regular.toFixed(2);
      if (transfer === undefined && globalRate) transfer = Math.round(regular * (100 - globalRate)) / 100;
      if (transfer !== undefined && transfer > 0 && transfer < regular) product.transferPrice = transfer.toFixed(2);
    }
    return product;
  });
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
function productLinks(pageLinks: Link[], query: string): string[] {
  return [...new Set(pageLinks.filter((item) => /\/(?:productos?|product)\//i.test(new URL(item.url).pathname)
    && matchesSearch(`${new URL(item.url).pathname} ${item.label}`, query)).map((item) => item.url))];
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

export async function inspect(source: Source, load: LoadPage = loadPage, budgetMs = 240_000, query = "torpedo") {
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
      const candidates = productLinks(pageLinks, query);
      const previousCount = listing.inspected.size;
      for (const record of parsed.records) {
        const original = productUrl(record, url);
        if (original) { inspected.add(productKey(original)); listing.inspected.add(productKey(original)); }
        else if (isSingleMate(text(record.name), text(record.description), query)) issue("Algunas publicaciones no informan el enlace original del producto.");
        if (original && isSingleMate(text(record.name), text(record.description), query) && !offers(record).some((offer) => availability(offer))) details.add(original);
      }
      for (const product of pricesFromHtml(html, productsFromRecords(parsed.records, { ...source, url }, query), url)) {
        const previous = products.get(productKey(product.url));
        products.set(productKey(product.url), previous?.transferPrice && !product.transferPrice
          ? { ...product, price: previous.price, transferPrice: previous.transferPrice, priceFrom: previous.priceFrom }
          : product);
      }
      for (const candidate of candidates) {
        if (!inspected.has(productKey(candidate))) details.add(candidate);
        inspected.add(productKey(candidate));
        listing.inspected.add(productKey(candidate));
      }
      // Search indexes and category lists can differ. Compare both when the
      // store links to a matching mate category, deduplicating original products.
      for (const link of pageLinks) {
        const category = new URL(link.url);
        if (!matchesSearch(`${category.pathname} ${link.label}`, query) || !/mates?/i.test(`${category.pathname} ${link.label}`) || /\/(?:productos?|product)\//i.test(category.pathname)) continue;
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
  // Some stores only advertise transfer discounts on the original detail page.
  for (const product of products.values()) if (!product.transferPrice) details.add(product.url);
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
      const current = products.get(productKey(url));
      const detailProducts = productsFromRecords(matching, { ...source, url: page.url }, query);
      if (matching.length && !detailProducts.length) products.delete(productKey(url));
      for (const product of pricesFromHtml(page.html, detailProducts.map((item) => ({ ...current, ...item })), page.url)) products.set(productKey(product.url), product);
    } catch (error) { issue(`Ficha de producto: ${error instanceof Error ? error.message : "consulta fallida"}`); }
  }
  report.inspectedProducts = inspected.size;
  report.products = products.size;
  report.status = report.issues.length ? report.pages ? "partial" : "error" : "complete";
  return { products: [...products.values()], report };
}

export async function searchSources(query?: string | null, selected = sourcesForQuery(query)) {
  const normalizedQuery = normalizeSearchQuery(query);
  const deadline = Date.now() + 240_000;
  const results = await withLimit(selected, 3, (source) => inspect(source, undefined, Math.max(0, deadline - Date.now()), normalizedQuery));
  const unique = new Map<string, Product>();
  for (const result of results) for (const product of result.products) unique.set(productKey(product.url), product);
  const products = [...unique.values()].sort((a, b) => Number(Boolean(b.price)) - Number(Boolean(a.price)) || a.store.localeCompare(b.store));
  const reports = results.map((result) => result.report);
  return { query: normalizedQuery, products, sources: reports, totalSources: selected.length,
    checkedSources: reports.filter((report) => report.pages > 0).length,
    completeSources: reports.filter((report) => report.status === "complete").length,
    errors: reports.filter((report) => report.status !== "complete").map((report) => `${report.store}: ${report.issues.join("; ")}`),
    updatedAt: new Date().toISOString() };
}
