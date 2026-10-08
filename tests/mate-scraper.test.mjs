import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractRecords, inspect, isSingleMate, pricesFromHtml, productKey, productsFromRecords, sourcesForQuery, withLimit } from "../lib/mate-scraper.ts";
import { searchContentHash } from "../lib/search-cache.ts";

const source = { store: "Tienda de prueba", url: "https://tienda.example/search/?q=torpedo" };
const product = (id, overrides = {}) => ({ "@type": "Product", name: `Mate Torpedo ${id}`, url: `/productos/torpedo-${id}/`,
  offers: { availability: "https://schema.org/InStock", price: 12345.67, priceCurrency: "ARS" }, ...overrides });
const schema = (records) => `<script type = 'application/ld+json'>${JSON.stringify({ "@graph": records })}</script>`;
const pagesLoader = (pages, calls = []) => async (url) => {
  calls.push(url);
  if (!pages.has(url) && /\/productos\//.test(url)) {
    const record = [...pages.values()].filter((html) => typeof html === "string").flatMap((html) => extractRecords(html).records)
      .find((item) => item.url && productKey(new URL(item.url, source.url).toString()) === productKey(url));
    if (record) return { html: schema([record]), url };
  }
  assert.ok(pages.has(url), `Unexpected request: ${url}`);
  const html = pages.get(url);
  if (html instanceof Error) throw html;
  return { html, url };
};

test("real store records include torpedos without calabaza in the summary and wooden torpedos", async () => {
  const samples = JSON.parse(await readFile(new URL("./fixtures/store-products.json", import.meta.url), "utf8"));
  for (const { store, record } of samples) {
    const result = productsFromRecords([record], { store, url: record.url ?? record.offers?.url ?? record.mainEntityOfPage["@id"] });
    assert.equal(result.length, 1, store);
    assert.equal(result[0].url, record.url ?? record.offers?.url ?? record.mainEntityOfPage["@id"]);
    assert.ok(result[0].price, store);
  }
});

test("available variants survive a sold-out first offer; numeric prices and nested AggregateOffer work", () => {
  const result = productsFromRecords([product(1, { offers: { "@type": "AggregateOffer", offers: [
    { availability: "https://schema.org/OutOfStock", price: 1 },
    { availability: "https://schema.org/InStock", price: 12345.67, priceCurrency: "ARS" },
  ] } })], source);
  assert.equal(result[0].price, "12345.67");
});

test("sold-out, preorder, missing stock and accessories do not become available mates", () => {
  const records = [
    product(1, { offers: { availability: "https://schema.org/OutOfStock" } }),
    product(2, { offers: { availability: "https://schema.org/PreOrder" } }),
    product(3, { offers: { price: 10 } }),
    product(4, { name: "Bombilla para torpedo" }),
    product(5, { name: "Mate imperial", description: "También vendemos torpedos" }),
  ];
  assert.deepEqual(productsFromRecords(records, source), []);
});

test("search terms change store URLs and only retain individual matching mates", () => {
  const queriedSources = sourcesForQuery("Imperial cuero");
  assert.equal(new URL(queriedSources[0].url).searchParams.get("q"), "imperial cuero");
  assert.equal(new URL(queriedSources.find((item) => item.store === "Estilo Austral").url).searchParams.get("s"), "imperial cuero");
  const records = [
    product(1, { name: "Mate Imperial Cuero Negro" }),
    product(2, { name: "Mate Imperial de Acero" }),
    product(3, { name: "Combo Mate Imperial Cuero y Bombilla" }),
  ];
  assert.equal(isSingleMate("Mate Imperial Cuero Negro", "", "imperial cuero"), true);
  assert.equal(isSingleMate("Mate Torpedo Cuero", "", "imperial cuero"), false);
  assert.deepEqual(productsFromRecords(records, source, "imperial cuero").map((item) => item.name), ["Mate Imperial Cuero Negro"]);
});

test("the search cache ignores the scrape timestamp when checking for changed results", () => {
  const result = { query: "torpedo", products: [], sources: [], totalSources: 32, checkedSources: 32, completeSources: 30, errors: [], updatedAt: "2026-10-08T12:00:00.000Z" };
  assert.equal(searchContentHash(result), searchContentHash({ ...result, updatedAt: "2026-10-08T12:30:00.000Z" }));
  assert.notEqual(searchContentHash(result), searchContentHash({ ...result, checkedSources: 31 }));
});

test("a paginated fragment without a load-more button still leads to page 3; no 20-product cap", async () => {
  const root = source.url;
  const pages = new Map([
    [root, schema(Array.from({ length: 12 }, (_, n) => product(n))) + '<a class="js-load-more">Mostrar más</a>'],
    [root + "&page=2", schema(Array.from({ length: 12 }, (_, n) => product(n + 12))) + '<a href="#">Comprar</a>'],
    [root + "&page=3", schema([product(24)])],
    [root + "&page=4", ""],
  ]);
  const calls = [];
  const result = await inspect(source, pagesLoader(pages, calls));
  assert.equal(result.products.length, 25);
  assert.equal(result.report.status, "complete");
  assert.equal(calls.filter((url) => url.includes("/search/")).length, 4);
});

test("a torpedo category supplements search results and duplicates keep the original link", async () => {
  const category = "https://tienda.example/mates/torpedos/";
  const original = "https://www.tienda.example/productos/torpedo-1/?utm_source=tienda";
  const pages = new Map([
    [source.url, schema([product(1, { url: original })]) + `<a href="${category}">Torpedos</a>`],
    [category, schema([product(1), product(2)]) + "<script>LS.productsCount = 2;</script>"],
  ]);
  const result = await inspect(source, pagesLoader(pages));
  assert.equal(result.products.length, 2);
  assert.equal(result.report.status, "complete");
  assert.equal(productKey(original), productKey("https://tienda.example/productos/torpedo-1/"));
});

test("WooCommerce listings lead to detail pages without importing recommended products", async () => {
  const url = "https://tienda.example/producto/torpedo-cuero/";
  const pages = new Map([
    [source.url, `<a href="${url}">Mate Torpedo Cuero</a>`],
    [url, schema([product(1, { url, offers: { availability: "https://schema.org/InStock", priceSpecification: [{ price: "65000", priceCurrency: "ARS" }] } }), product(2)])],
  ]);
  const result = await inspect(source, pagesLoader(pages));
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].url, url);
  assert.equal(result.products[0].price, "65000.00");
});

test("detail pages without declared stock are excluded and coverage is partial", async () => {
  const url = "https://tienda.example/producto/torpedo-cuero/";
  const result = await inspect(source, pagesLoader(new Map([
    [source.url, `<a href="${url}">Torpedo</a>`],
    [url, schema([product(1, { url, offers: { price: 100 } })])],
  ])));
  assert.equal(result.products.length, 0);
  assert.equal(result.report.status, "partial");
});

test("page failures retain products and report partial coverage", async () => {
  const result = await inspect(source, pagesLoader(new Map([
    [source.url, schema([product(1)]) + '<a class="js-load-more">Más</a>'],
    [source.url + "&page=2", new Error("HTTP 403")],
  ])));
  assert.equal(result.products.length, 1);
  assert.equal(result.report.status, "partial");
  assert.ok(result.report.issues.includes("HTTP 403"));
});

test("repeated pages with unmet catalog totals are partial, not complete", async () => {
  const html = schema([product(1)]) + "<script>LS.productsCount = 3;</script>";
  const result = await inspect(source, pagesLoader(new Map([
    [source.url, html], [source.url + "&page=2", html],
  ])));
  assert.equal(result.report.status, "partial");
  assert.match(result.report.issues[0], /3 publicaciones/);
});

test("malformed JSON-LD is reported; unrelated scripts and invalid URLs are ignored", () => {
  const parsed = extractRecords(schema([product(1, { "@type": ["Thing", "Product"] })]) + '<script type="application/ld+json">{broken</script>');
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.malformed, 1);
  assert.deepEqual(productsFromRecords([product(2, { url: "javascript:alert(1)" }), product(3, { url: "https://other.example/product/torpedo/" })], source), []);
});

test("a time limit is visible instead of silently truncating products", async () => {
  const result = await inspect(source, async () => { throw new Error("must not fetch"); }, -1);
  assert.equal(result.report.status, "error");
  assert.match(result.report.issues[0], /límite/);
});

test("store concurrency never exceeds three and results retain source order", async () => {
  let active = 0;
  let peak = 0;
  const result = await withLimit([0, 1, 2, 3, 4, 5], 3, async (id) => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5)); active--;
    return id;
  });
  assert.equal(peak, 3);
  assert.deepEqual(result, [0, 1, 2, 3, 4, 5]);
});

test("only individual mates survive combo, kit, box and accessory bundle names", () => {
  const bundles = [
    "COMBO FULL TORPEDO EXCLUSIVO", "PROMO BOX 132 - Mate Torpedo, Bombilla y Box",
    "Torpedo Rey + Bombillón", "Mate torpedo con bombilla", "Set matero torpedo",
    "Kit torpedo y termo", "Pack torpedos 3x2", "Box para mamá - torpedo",
    "Mate torpedo + pico loro aceroinox", "Mate Torpedo, Yerbera y Bombillón",
  ];
  for (const name of bundles) assert.equal(isSingleMate(name), false, name);
  for (const name of ["Torpedo Joyero", "Mate Torpedo Cuero + Base de Alpaca", "Torpedo de Algarrobo", "Mate Torpedo Virola y Base de Bronce", "Mate Torpedo PROMO"]) {
    assert.equal(isSingleMate(name), true, name);
  }
  assert.equal(isSingleMate("Mate Torpedo", "Incluye mate y bombilla de acero"), false);
  assert.equal(isSingleMate("Mate Torpedo", "Combiná este mate con tu bombilla preferida"), true);
  assert.equal(isSingleMate("Mate Torpedo", "No incluye bombilla ni termo"), true);
  assert.equal(isSingleMate("Mate Torpedo", "Incluye mate sin bombilla"), true);
  assert.deepEqual(productsFromRecords(bundles.map((name, i) => product(i, { name })), source), []);
});

test("real store cards pair transfer prices with the right mate and current sale price", async () => {
  const fixtures = JSON.parse(await readFile(new URL("./fixtures/transfer-prices.json", import.meta.url), "utf8"));
  for (const fixture of fixtures) {
    const url = fixture.record.url ?? fixture.record.offers.url;
    const result = pricesFromHtml(fixture.html, productsFromRecords([fixture.record], { store: fixture.store, url }), url)[0];
    assert.equal(result.price, fixture.expectedPrice, fixture.store);
    assert.equal(result.transferPrice, fixture.expectedTransferPrice, fixture.store);
  }
});

const priceCard = (id, normal, discount, method = "Transferencia", variants) => `<div class="js-product-container" ${variants ? `data-variants='${JSON.stringify(variants)}'` : ""}>
  <a href="/productos/torpedo-${id}/">Mate torpedo</a><span class="js-price-display">${normal}</span>
  <span class="js-payment-discount-price-product">${discount}</span><span class="js-payment-discount-name-product">${method}</span></div>`;

test("prices stay scoped to each card, not the cart, another mate or card-payment discounts", () => {
  const records = [product(1), product(2), product(3)];
  const html = `<span class="js-payment-discount-price-cart">$1.000,00</span>`
    + priceCard(1, "$50.000,00", "$40.000,00") + priceCard(2, "$60.000,00", "$51.000,00")
    + priceCard(3, "$70.000,00", "$49.000,00", "Tarjeta de débito");
  const result = pricesFromHtml(html, productsFromRecords(records, source), source.url);
  assert.equal(result[0].transferPrice, "40000.00");
  assert.equal(result[1].transferPrice, "51000.00");
  assert.equal(result[2].transferPrice, undefined);
});

test("sold-out variants cannot supply a transfer price; cheapest available transfer and paired base are used", () => {
  const variants = [
    { available: false, stock: 0, price_number: 30000, price_with_payment_discount_short: "$20.000,00" },
    { available: true, stock: "0", price_number: 35000, price_with_payment_discount_short: "$25.000,00" },
    { available: true, stock: 2, price_number: 50000, price_with_payment_discount_short: "$45.000,00" },
    { available: true, stock: 1, price_number: 60000, price_with_payment_discount_short: "$42.000,00" },
  ];
  const result = pricesFromHtml(priceCard(1, "$30.000,00", "$20.000,00", "Transferencia", variants), productsFromRecords([product(1)], source), source.url)[0];
  assert.equal(result.price, "60000.00");
  assert.equal(result.transferPrice, "42000.00");
  assert.equal(result.priceFrom, true);
});

test("explicit transfer percentages apply to current prices, without mixing up sale prices or conditions", () => {
  const current = productsFromRecords([product(1, { offers: { availability: "InStock", price: 65000, priceCurrency: "ARS" } })], source);
  assert.equal(pricesFromHtml('<div class="et-campaign">10% DE DESCUENTO PAGANDO CON TRANSFERENCIA BANCARIA</div>', current, source.url)[0].transferPrice, "58500.00");
  for (const message of ["Hasta 20% off con transferencia", "20% off con transferencia en compras superiores a $100.000", "20% de descuento con tarjeta", "20% off con transferencia con cupón MATE", "Precio sin impuestos $30.000"]) {
    assert.equal(pricesFromHtml(`<div class="et-campaign">${message}</div>`, current, source.url)[0].transferPrice, undefined, message);
  }
  assert.equal(pricesFromHtml(priceCard(1, "$50.000,00", "$45.000,00") + '<div class="et-campaign">20% off con transferencia</div>', current, source.url)[0].transferPrice, "45000.00");
});

test("detail-only transfer discounts are fetched even when a listing already has schema and stock", async () => {
  const url = "https://tienda.example/productos/torpedo-1/";
  const calls = [];
  const result = await inspect(source, pagesLoader(new Map([
    [source.url, schema([product(1)])],
    [url, schema([product(1)]) + '<div class="et-campaign">15% off por transferencia</div>'],
  ]), calls));
  assert.ok(calls.includes(url));
  assert.equal(result.products[0].transferPrice, "10493.82");
  assert.equal(result.report.status, "complete");
});

test("a listing transfer price survives duplicate listings without discount markup", async () => {
  const category = "https://tienda.example/mates/torpedos/";
  const result = await inspect(source, pagesLoader(new Map([
    [source.url, schema([product(1)]) + priceCard(1, "$50.000,00", "$40.000,00") + `<a href="${category}">Torpedos</a>`],
    [category, schema([product(1)])],
  ])));
  assert.equal(result.products[0].transferPrice, "40000.00");
  assert.equal(result.products[0].price, "50000.00");
});

test("a later detail page declaring the item a combo or sold out removes it", async () => {
  const url = "https://tienda.example/productos/torpedo-1/";
  for (const changes of [{ name: "Combo Torpedo y Bombilla" }, { offers: { availability: "OutOfStock" } }]) {
    const result = await inspect(source, pagesLoader(new Map([
      [source.url, schema([product(1)])], [url, schema([product(1, changes)])],
    ])));
    assert.deepEqual(result.products, []);
  }
});

test("detail prices with two amounts use the transfer amount, not the regular amount", () => {
  const url = "https://tienda.example/productos/torpedo-1/";
  const current = productsFromRecords([product(1, { url, offers: { availability: "InStock", price: 65000 } })], source);
  const html = '<div class="summary"><p>Precio habitual $65.000,00. Con transferencia: $58.500,00</p></div>';
  const result = pricesFromHtml(html, current, url)[0];
  assert.equal(result.transferPrice, "58500.00");
  assert.equal(pricesFromHtml(html, current, source.url)[0].transferPrice, undefined);
});

test("conditional descriptions next to a transfer banner do not become universal discounts", () => {
  const current = productsFromRecords([product(1)], source);
  const html = '<div><h3 class="js-informative-banner-title">20% OFF CON TRANSFERENCIA</h3><p>Exclusivo para compras superiores a $100.000</p></div>';
  assert.equal(pricesFromHtml(html, current, source.url)[0].transferPrice, undefined);
});
