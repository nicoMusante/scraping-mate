"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, ImageOff, LoaderCircle, RefreshCw, Search, Store } from "lucide-react";
import type { Product, SourceReport } from "@/lib/mate-scraper";

type SearchResponse = { products: Product[]; sources: SourceReport[]; totalSources: number; checkedSources: number; completeSources: number; errors: string[]; updatedAt: string };

function formatPrice(product: Product) {
  if (!product.price) return "Precio no informado";
  const price = product.price.replace(/[^\d.,]/g, "");
  const n = Number(price.includes(",") ? price.replace(/\./g, "").replace(",", ".") : price);
  return Number.isFinite(n) ? new Intl.NumberFormat("es-AR", { style: "currency", currency: product.currency || "ARS", maximumFractionDigits: 0 }).format(n) : product.price;
}

export default function Home() {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyWithPrice, setOnlyWithPrice] = useState(false);
  const [store, setStore] = useState("Todas las tiendas");
  const search = useCallback(async () => {
    try { const response = await fetch("/api/buscar", { cache: "no-store" }); if (!response.ok) throw new Error(); setData(await response.json()); }
    catch { setData({ products: [], sources: [], totalSources: 17, checkedSources: 0, completeSources: 0, errors: ["No pudimos conectar con las tiendas. Probá actualizar en unos minutos."], updatedAt: new Date().toISOString() }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const initialSearch = setTimeout(() => void search(), 0);
    return () => clearTimeout(initialSearch);
  }, [search]);
  const stores = useMemo(() => ["Todas las tiendas", ...(data?.sources.map((item) => item.store) ?? []).sort()], [data]);
  const products = useMemo(() => (data?.products ?? []).filter((item) => (!onlyWithPrice || Boolean(item.price)) && (store === "Todas las tiendas" || item.store === store)), [data, onlyWithPrice, store]);
  return <main className="min-h-screen bg-[#f6f2eb] text-[#18271f]">
    <header className="border-b border-[#d7cbb9] bg-[#173b2e] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full border border-[#d8ab63] bg-[#234c3b] font-serif text-xl text-[#f4cd8b]">M</span><div><h1 className="font-serif text-xl leading-none">Mate Finder</h1><p className="mt-1 text-xs tracking-wide text-[#cad8cf]">MATES TIPO TORPEDO</p></div></div>
      <button onClick={() => { setLoading(true); void search(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-[#6d947f] px-4 py-2 text-sm font-medium transition hover:bg-[#285542] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Actualizar</button>
    </div></header>
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-9 sm:px-8">
      <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#956a31]">Búsqueda activa</p><h2 className="max-w-3xl font-serif text-4xl leading-[1.03] tracking-tight sm:text-6xl">Mates tipo torpedo, en un solo lugar.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-[#536158]">Buscamos torpedos de todos los materiales, incluidos combos con mate. Sólo se muestran productos con stock informado por cada tienda.</p></div><div className="rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] px-5 py-4 shadow-sm"><p className="text-3xl font-semibold tabular-nums">{loading ? "—" : data?.products.length ?? 0}</p><p className="text-sm text-[#637168]">hallazgos disponibles</p></div></div>
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"><div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-[#f4efe6] px-4 py-3 text-sm text-[#566258]"><Search size={17} /><span>torpedo · todos los materiales</span></div><div className="flex flex-wrap items-center gap-3"><select aria-label="Filtrar por tienda" value={store} onChange={(event) => setStore(event.target.value)} className="h-11 max-w-[190px] rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#a97b3d]">{stores.map((name) => <option key={name}>{name}</option>)}</select><label className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-1 text-sm"><input type="checkbox" checked={onlyWithPrice} onChange={(event) => setOnlyWithPrice(event.target.checked)} className="h-4 w-4 accent-[#234c3b]" /> Sólo con precio</label></div></div>
      {!loading && data && <details className="mt-5 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-4 text-sm">
        <summary className="cursor-pointer font-medium">{data.completeSources} de {data.totalSources} tiendas con búsqueda completa · ver detalle</summary>
        <p className="mt-3 text-[#637168]">{data.errors.length ? "La búsqueda quedó incompleta en algunas tiendas; puede haber más torpedos disponibles." : "Se recorrieron las páginas que las tiendas permitieron consultar."} Los productos agotados o sin stock verificable no aparecen.</p>
        {!data.sources.length && <p role="alert" className="mt-3 text-[#8a5a20]">{data.errors.join(" ")}</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{data.sources.map((source) => <li key={source.store} className="rounded-xl bg-[#f4efe6] p-3">
          <div className="flex flex-wrap justify-between gap-2"><a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">{source.store}</a><span>{source.products} torpedos en stock</span></div>
          <p className="mt-1 text-xs text-[#637168]">{source.status === "complete" ? "Búsqueda completa" : source.status === "partial" ? "Búsqueda parcial" : "No se pudo consultar"} · {source.pages} páginas · {source.inspectedProducts} publicaciones revisadas</p>
          {source.issues.length > 0 && <p className="mt-2 text-xs text-[#8a5a20]">{source.issues.join(" · ")}</p>}
        </li>)}</ul>
      </details>}
      {loading ? <div className="grid min-h-[320px] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#956a31]" size={31} /><p className="mt-3 text-sm text-[#637168]">Revisando tiendas y disponibilidad…</p></div></div> : products.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={`${product.store}-${product.url}`} className="group overflow-hidden rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] shadow-[0_2px_0_rgba(23,59,46,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"><div className="aspect-[4/3] bg-[#e9e1d3]">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-[#968c7d]"><ImageOff size={26} /></div>}</div><div className="p-5"><div className="mb-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#4b745c]"><Store size={13} />{product.store}</span><span className="rounded-full bg-[#e4f0e7] px-2.5 py-1 text-xs font-medium text-[#29613e]">En stock</span></div><h3 className="min-h-12 font-serif text-xl leading-6">{product.name}</h3><div className="mt-4 flex items-end justify-between gap-3"><p className="text-lg font-semibold text-[#243b2e]">{formatPrice(product)}</p><a href={product.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a5a20] underline decoration-[#cfad75] underline-offset-4">Ver tienda <ExternalLink size={14} /></a></div></div></article>)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-[#cabba6] bg-[#fffdf9] px-6 py-16 text-center"><p className="font-serif text-2xl">No encontramos coincidencias ahora.</p><p className="mt-2 text-sm text-[#637168]">Las tiendas pueden cambiar sus publicaciones o bloquear consultas automáticas. Probá actualizar más tarde.</p></div>}
      <footer className="mt-10 flex flex-col gap-2 border-t border-[#d7cbb9] pt-5 text-xs text-[#687269] sm:flex-row sm:items-center sm:justify-between"><span>{data?.checkedSources ?? 0} tiendas consultadas{data?.updatedAt ? ` · actualizado ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}` : ""}</span><span>Precios y stock sujetos a cambios en la tienda.</span></footer>
    </section>
  </main>;
}
