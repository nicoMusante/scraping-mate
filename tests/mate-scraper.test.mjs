import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractRecords, inspect, productKey, productsFromRecords, withLimit } from "../lib/mate-scraper.ts";

const source = { store: "Tienda de prueba", url: "https://tienda.example/search/?q=torpedo" };
const product = (id, overrides = {}) => ({ "@type": "Product", name: `Mate Torpedo ${id}`, url: `/productos/torpedo-${id}/`,
  offers: { availability: "https://schema.org/InStock", price: 12345.67, priceCurrency: "ARS" }, ...overrides });
const schema = (records) => `<script type = 'application/ld+json'>${JSON.stringify({ "@graph": records })}</script>`;
const pagesLoader = (pages, calls = []) => async (url) => {
  calls.push(url);
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
  assert.equal(calls.length, 4);
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
  assert.equal(result.products[0].price, "65000");
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
