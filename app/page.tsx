"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, ImageOff, LoaderCircle, RefreshCw, Search, Store, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Product, SourceReport } from "@/lib/mate-scraper";

type SearchResponse = { products: Product[]; sources: SourceReport[]; totalSources: number; checkedSources: number; completeSources: number; errors: string[]; updatedAt: string };
type MateMark = "liked" | "disliked";
type MarkFilter = "considering" | "liked" | "disliked" | "unmarked" | "all";
type PriceOrder = "featured" | "lowest" | "highest";

const MARKS_STORAGE_KEY = "mate-finder-marks-v1";

function formatPrice(product: Product, value = product.price) {
  if (!value) return "Precio no informado";
  const price = value.replace(/[^\d.,]/g, "");
  const n = Number(price.includes(",") ? price.replace(/\./g, "").replace(",", ".") : price);
  return Number.isFinite(n) ? new Intl.NumberFormat("es-AR", { style: "currency", currency: product.currency || "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) : value;
}

function numericPrice(product: Product) {
  const value = product.transferPrice ?? product.price;
  if (!value) return undefined;
  const price = value.replace(/[^\d.,]/g, "");
  const n = Number(price.includes(",") ? price.replace(/\./g, "").replace(",", ".") : price);
  return Number.isFinite(n) ? n : undefined;
}

function ProductPrice({ product }: { product: Product }) {
  return <div>
    {product.transferPrice ? <>
      <p className="text-xs font-medium text-[#4b745c]">{product.priceFrom ? "Desde · " : ""}Con transferencia</p>
      <p className="text-xl font-semibold text-[#243b2e]">{formatPrice(product, product.transferPrice)}</p>
      <p className="mt-1 text-xs text-[#637168]">Precio habitual: {formatPrice(product)}</p>
    </> : <p className="text-lg font-semibold text-[#243b2e]">{product.priceFrom ? "Desde " : ""}{formatPrice(product)}</p>}
  </div>;
}

function MarkButtons({ mark, onMark }: { mark?: MateMark; onMark: (mark?: MateMark) => void }) {
  return <div className="flex items-center gap-1" aria-label="Marcar este mate">
    <button type="button" onClick={() => onMark(mark === "liked" ? undefined : "liked")} aria-label="Me gusta" aria-pressed={mark === "liked"} className={`grid h-9 w-9 place-items-center rounded-full border transition ${mark === "liked" ? "border-[#bb7040] bg-[#f9e4d4] text-[#9a4d20]" : "border-[#d7cbb9] bg-white text-[#7b8179] hover:border-[#bb7040] hover:text-[#9a4d20]"}`}><ThumbsUp size={16} /></button>
    <button type="button" onClick={() => onMark(mark === "disliked" ? undefined : "disliked")} aria-label="No me gusta" aria-pressed={mark === "disliked"} className={`grid h-9 w-9 place-items-center rounded-full border transition ${mark === "disliked" ? "border-[#7b8179] bg-[#e9e6e0] text-[#354039]" : "border-[#d7cbb9] bg-white text-[#7b8179] hover:border-[#7b8179] hover:text-[#354039]"}`}><ThumbsDown size={16} /></button>
  </div>;
}

export default function Home() {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyWithPrice, setOnlyWithPrice] = useState(false);
  const [store, setStore] = useState("Todas las tiendas");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [priceOrder, setPriceOrder] = useState<PriceOrder>("featured");
  const [markFilter, setMarkFilter] = useState<MarkFilter>("considering");
  const [marks, setMarks] = useState<Record<string, MateMark>>({});
  const [marksLoaded, setMarksLoaded] = useState(false);

  const search = useCallback(async () => {
    try { const response = await fetch("/api/buscar", { cache: "no-store" }); if (!response.ok) throw new Error(); setData(await response.json()); }
    catch { setData({ products: [], sources: [], totalSources: 17, checkedSources: 0, completeSources: 0, errors: ["No pudimos conectar con las tiendas. Probá actualizar en unos minutos."], updatedAt: new Date().toISOString() }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialSearch = setTimeout(() => void search(), 0);
    return () => clearTimeout(initialSearch);
  }, [search]);

  useEffect(() => {
    const restoreMarks = setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(MARKS_STORAGE_KEY) ?? "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          setMarks(Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, MateMark] => entry[1] === "liked" || entry[1] === "disliked")));
        }
      } catch { /* Invalid saved data is ignored. */ }
      setMarksLoaded(true);
    }, 0);
    return () => clearTimeout(restoreMarks);
  }, []);

  useEffect(() => {
    if (marksLoaded) window.localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(marks));
  }, [marks, marksLoaded]);

  const setMark = useCallback((product: Product, mark?: MateMark) => {
    setMarks((current) => {
      const next = { ...current };
      if (mark) next[product.url] = mark;
      else delete next[product.url];
      return next;
    });
  }, []);

  const stores = useMemo(() => ["Todas las tiendas", ...(data?.sources.map((item) => item.store) ?? []).sort()], [data]);
  const products = useMemo(() => {
    const min = Number(minimumPrice);
    const max = Number(maximumPrice);
    const filtered = (data?.products ?? []).filter((product) => {
      const mark = marks[product.url];
      const price = numericPrice(product);
      const hasDesiredMark = markFilter === "all" || (markFilter === "considering" ? mark !== "disliked" : markFilter === "unmarked" ? !mark : mark === markFilter);
      return (!onlyWithPrice || price !== undefined)
        && (store === "Todas las tiendas" || product.store === store)
        && (!minimumPrice || (price !== undefined && price >= min))
        && (!maximumPrice || (price !== undefined && price <= max))
        && hasDesiredMark;
    });
    if (priceOrder === "featured") return filtered;
    return [...filtered].sort((a, b) => {
      const first = numericPrice(a) ?? Number.POSITIVE_INFINITY;
      const second = numericPrice(b) ?? Number.POSITIVE_INFINITY;
      return priceOrder === "lowest" ? first - second : second - first;
    });
  }, [data, marks, markFilter, maximumPrice, minimumPrice, onlyWithPrice, priceOrder, store]);

  return <main className="min-h-screen bg-[#f6f2eb] text-[#18271f]">
    <header className="border-b border-[#d7cbb9] bg-[#173b2e] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full border border-[#d8ab63] bg-[#234c3b] font-serif text-xl text-[#f4cd8b]">M</span><div><h1 className="font-serif text-xl leading-none">Mate Finder</h1><p className="mt-1 text-xs tracking-wide text-[#cad8cf]">MATES TIPO TORPEDO</p></div></div>
      <button onClick={() => { setLoading(true); void search(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-[#6d947f] px-4 py-2 text-sm font-medium transition hover:bg-[#285542] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Actualizar</button>
    </div></header>
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-9 sm:px-8">
      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#956a31]">Búsqueda activa</p><h2 className="max-w-3xl font-serif text-4xl leading-[1.03] tracking-tight sm:text-6xl">Mates tipo torpedo, en un solo lugar.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-[#536158]">Filtrá por precio, tienda y tus marcas. Guardamos tus elecciones en este navegador para ayudarte a comparar.</p></div><div className="rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] px-5 py-4 shadow-sm"><p className="text-3xl font-semibold tabular-nums">{loading ? "—" : products.length}</p><p className="text-sm text-[#637168]">mates según tus filtros</p></div></div>
      <div className="mt-8 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-[#f4efe6] px-4 py-3 text-sm text-[#566258]"><Search size={17} /><span>torpedo · todos los materiales</span></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Tienda o página</span><select aria-label="Filtrar por tienda o página" value={store} onChange={(event) => setStore(event.target.value)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]">{stores.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Precio desde</span><input inputMode="numeric" type="number" min="0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Sin mínimo" className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Precio hasta</span><input inputMode="numeric" type="number" min="0" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="Sin máximo" className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Ordenar por precio</span><select aria-label="Ordenar por precio" value={priceOrder} onChange={(event) => setPriceOrder(event.target.value as PriceOrder)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]"><option value="featured">Como aparecen</option><option value="lowest">Más baratos</option><option value="highest">Más caros</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Mis marcas</span><select aria-label="Filtrar por mis marcas" value={markFilter} onChange={(event) => setMarkFilter(event.target.value as MarkFilter)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]"><option value="considering">Me gustan o sin marcar</option><option value="liked">Me gustan</option><option value="disliked">No me gustan</option><option value="unmarked">Sin marcar</option><option value="all">Todos</option></select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#637168]"><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={onlyWithPrice} onChange={(event) => setOnlyWithPrice(event.target.checked)} className="h-4 w-4 accent-[#234c3b]" /> Sólo con precio</label><span>Tus marcas se guardan sólo en este navegador.</span></div>
      </div>
      {!loading && data && <details className="mt-5 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-4 text-sm">
        <summary className="cursor-pointer font-medium">{data.completeSources} de {data.totalSources} tiendas con búsqueda completa · ver detalle</summary>
        <p className="mt-3 text-[#637168]">{data.errors.length ? "La búsqueda quedó incompleta en algunas tiendas; puede haber más torpedos disponibles." : "Se recorrieron las páginas que las tiendas permitieron consultar."} Los productos agotados o sin stock verificable no aparecen.</p>
        {!data.sources.length && <p role="alert" className="mt-3 text-[#8a5a20]">{data.errors.join(" ")}</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{data.sources.map((source) => <li key={source.store} className="rounded-xl bg-[#f4efe6] p-3"><div className="flex flex-wrap justify-between gap-2"><a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">{source.store}</a><span>{source.products} torpedos en stock</span></div><p className="mt-1 text-xs text-[#637168]">{source.status === "complete" ? "Búsqueda completa" : source.status === "partial" ? "Búsqueda parcial" : "No se pudo consultar"} · {source.pages} páginas · {source.inspectedProducts} publicaciones revisadas</p>{source.issues.length > 0 && <p className="mt-2 text-xs text-[#8a5a20]">{source.issues.join(" · ")}</p>}</li>)}</ul>
      </details>}
      {loading ? <div className="grid min-h-[320px] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#956a31]" size={31} /><p className="mt-3 text-sm text-[#637168]">Revisando tiendas y disponibilidad…</p></div></div> : products.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={`${product.store}-${product.url}`} className="group overflow-hidden rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] shadow-[0_2px_0_rgba(23,59,46,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"><div className="aspect-[4/3] bg-[#e9e1d3]">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-[#968c7d]"><ImageOff size={26} /></div>}</div><div className="p-5"><div className="mb-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#4b745c]"><Store size={13} />{product.store}</span><MarkButtons mark={marks[product.url]} onMark={(mark) => setMark(product, mark)} /></div><h3 className="min-h-12 font-serif text-xl leading-6">{product.name}</h3><div className="mt-4 flex items-end justify-between gap-3"><ProductPrice product={product} /><a href={product.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a5a20] underline decoration-[#cfad75] underline-offset-4">Ver tienda <ExternalLink size={14} /></a></div></div></article>)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-[#cabba6] bg-[#fffdf9] px-6 py-16 text-center"><Heart className="mx-auto text-[#956a31]" size={27} /><p className="mt-3 font-serif text-2xl">No hay mates con estos filtros.</p><p className="mt-2 text-sm text-[#637168]">Probá cambiar el precio, la tienda o tus marcas.</p></div>}
      <footer className="mt-10 flex flex-col gap-2 border-t border-[#d7cbb9] pt-5 text-xs text-[#687269] sm:flex-row sm:items-center sm:justify-between"><span>{data?.checkedSources ?? 0} tiendas consultadas{data?.updatedAt ? ` · actualizado ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}` : ""}</span><span>Precios y stock sujetos a cambios en la tienda.</span></footer>
    </section>
  </main>;
}
