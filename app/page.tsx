"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Grid2X2, Heart, ImageOff, LayoutGrid, List, LoaderCircle, LogIn, LogOut, RefreshCw, Search, SlidersHorizontal, Store, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import type { Product, SourceReport } from "@/lib/mate-scraper";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "@/components/install-app-button";
import type { User } from "@supabase/supabase-js";

type SearchResponse = { query: string; products: Product[]; sources: SourceReport[]; totalSources: number; checkedSources: number; completeSources: number; errors: string[]; updatedAt: string; cache?: { state: "cached" | "updated" | "live"; changed?: boolean; checkedAt: string } };
type MateMark = "liked" | "disliked";
type MarkFilter = "considering" | "liked" | "disliked" | "unmarked" | "all";
type PriceOrder = "featured" | "lowest" | "highest";
type ViewMode = "list" | "grid" | "dense";
type ResultsMode = "all" | "pages";
type ProductMarkRow = { product_url: string; mark: MateMark };

const MARKS_STORAGE_KEY = "mate-finder-marks-v1";
const MATE_TYPES = ["torpedo", "camionero", "imperial", "criollo", "uruguayo", "perita", "galleta"];
const RESULTS_PER_PAGE = 24;

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

function matchesMarkFilter(markFilter: MarkFilter, mark?: MateMark) {
  return markFilter === "all" || (markFilter === "considering" ? mark !== "disliked" : markFilter === "unmarked" ? !mark : mark === markFilter);
}

function ProductPrice({ product, compact = false }: { product: Product; compact?: boolean }) {
  return <div>
    {product.transferPrice ? <>
      <p className="text-xs font-medium text-[#4b745c]">{product.priceFrom ? "Desde · " : ""}{compact ? "Transferencia" : "Con transferencia"}</p>
      <p className={`${compact ? "text-base" : "text-xl"} font-semibold text-[#243b2e]`}>{formatPrice(product, product.transferPrice)}</p>
      {!compact && <p className="mt-1 text-xs text-[#637168]">Precio habitual: {formatPrice(product)}</p>}
    </> : <p className={`${compact ? "text-base" : "text-lg"} font-semibold text-[#243b2e]`}>{product.priceFrom ? "Desde " : ""}{formatPrice(product)}</p>}
  </div>;
}

function MarkButtons({ mark, onMark, compact = false }: { mark?: MateMark; onMark: (mark?: MateMark) => void; compact?: boolean }) {
  return <div className="flex items-center gap-1" aria-label="Marcar este mate">
    <button type="button" onClick={() => onMark(mark === "liked" ? undefined : "liked")} aria-label="Me gusta" aria-pressed={mark === "liked"} className={`grid ${compact ? "h-8 w-8" : "h-10 w-10"} place-items-center rounded-full border transition ${mark === "liked" ? "border-[#bb7040] bg-[#f9e4d4] text-[#9a4d20]" : "border-[#d7cbb9] bg-white text-[#7b8179] hover:border-[#bb7040] hover:text-[#9a4d20]"}`}><ThumbsUp size={compact ? 14 : 16} /></button>
    <button type="button" onClick={() => onMark(mark === "disliked" ? undefined : "disliked")} aria-label="No me gusta" aria-pressed={mark === "disliked"} className={`grid ${compact ? "h-8 w-8" : "h-10 w-10"} place-items-center rounded-full border transition ${mark === "disliked" ? "border-[#7b8179] bg-[#e9e6e0] text-[#354039]" : "border-[#d7cbb9] bg-white text-[#7b8179] hover:border-[#7b8179] hover:text-[#354039]"}`}><ThumbsDown size={compact ? 14 : 16} /></button>
  </div>;
}

export default function Home() {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("torpedo");
  const [selectedType, setSelectedType] = useState("torpedo");
  const [onlyWithPrice, setOnlyWithPrice] = useState(false);
  const [store, setStore] = useState("Todas las tiendas");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [priceOrder, setPriceOrder] = useState<PriceOrder>("featured");
  const [markFilter, setMarkFilter] = useState<MarkFilter>("considering");
  const [marks, setMarks] = useState<Record<string, MateMark>>({});
  const [marksLoaded, setMarksLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [resultsMode, setResultsMode] = useState<ResultsMode>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const search = useCallback(async (term: string, refresh = false) => {
    const query = term.trim() || "torpedo";
    try { const response = await fetch(`/api/buscar?q=${encodeURIComponent(query)}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }); if (!response.ok) throw new Error(); setData(await response.json()); setCurrentPage(1); }
    catch { setData({ query, products: [], sources: [], totalSources: 32, checkedSources: 0, completeSources: 0, errors: ["No pudimos conectar con las tiendas. Probá actualizar en unos minutos."], updatedAt: new Date().toISOString() }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialSearch = setTimeout(() => void search("torpedo"), 0);
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

  const mergeRemoteMarks = useCallback(async (activeUser: User) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("product_marks").select("product_url, mark");
    if (error) {
      setAuthMessage("No pudimos cargar tus marcas guardadas. Probá de nuevo.");
      return;
    }

    const saved = Object.fromEntries((data as ProductMarkRow[]).map(({ product_url, mark }) => [product_url, mark]));
    setMarks((local) => {
      const merged = { ...saved, ...local };
      const localRows = Object.entries(local).map(([product_url, mark]) => ({ user_id: activeUser.id, product_url, mark }));
      if (localRows.length) void supabase.from("product_marks").upsert(localRows, { onConflict: "user_id,product_url" });
      return merged;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user: activeUser } }) => {
      setUser(activeUser);
      if (activeUser) void mergeRemoteMarks(activeUser);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) void mergeRemoteMarks(activeUser);
    });
    return () => subscription.unsubscribe();
  }, [mergeRemoteMarks]);

  const submitAuth = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    const supabase = createClient();
    const credentials = { email: email.trim(), password };
    const { data, error } = authMode === "login"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    if (error) setAuthMessage(error.message);
    else if (data.user && authMode === "signup" && !data.session) setAuthMessage("Te enviamos un correo para confirmar tu cuenta. Después iniciá sesión.");
    else { setAuthOpen(false); setPassword(""); }
    setAuthLoading(false);
  }, [authMode, email, password]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const stores = useMemo(() => ["Todas las tiendas", ...(data?.sources.map((item) => item.store) ?? []).sort()], [data]);
  const products = useMemo(() => {
    const min = Number(minimumPrice);
    const max = Number(maximumPrice);
    const filtered = (data?.products ?? []).filter((product) => {
      const mark = marks[product.url];
      const price = numericPrice(product);
      const hasDesiredMark = matchesMarkFilter(markFilter, mark);
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

  const setMark = useCallback((product: Product, mark?: MateMark) => {
    setMarks((current) => {
      const next = { ...current };
      if (mark) next[product.url] = mark;
      else delete next[product.url];
      return next;
    });
    if (!user) return;
    const supabase = createClient();
    const request = mark
      ? supabase.from("product_marks").upsert({ user_id: user.id, product_url: product.url, mark }, { onConflict: "user_id,product_url" })
      : supabase.from("product_marks").delete().eq("product_url", product.url);
    void request.then(({ error }) => {
      if (error) setAuthMessage("No pudimos guardar tu marca. Revisá tu conexión e intentá otra vez.");
    });
  }, [user]);

  const compactCards = viewMode !== "list";
  const productGridClass = viewMode === "list"
    ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    : viewMode === "grid"
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
      : "grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6";
  const totalPages = Math.max(1, Math.ceil(products.length / RESULTS_PER_PAGE));
  const activePage = Math.min(currentPage, totalPages);
  const visibleProducts = resultsMode === "all" ? products : products.slice((activePage - 1) * RESULTS_PER_PAGE, activePage * RESULTS_PER_PAGE);

  return <main className="min-h-dvh bg-[#f6f2eb] text-[#18271f]">
    <header className="ios-safe-top border-b border-[#d7cbb9] bg-[#173b2e] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-3"><Image src="/icon-192.png" alt="Mate Finder" width={40} height={40} priority className="h-10 w-10 rounded-xl" /><div><h1 className="font-serif text-xl leading-none">Mate Finder</h1><p className="mt-1 text-xs tracking-wide text-[#cad8cf]">BUSCADOR DE MATES</p></div></div>
      <div className="flex items-center gap-2"><InstallAppButton /><button onClick={() => { setLoading(true); void search(searchTerm, true); }} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#6d947f] px-3 text-sm font-medium transition hover:bg-[#285542] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">Actualizar</span></button>{user ? <button type="button" onClick={() => void signOut()} title="Cerrar sesión" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#6d947f] px-3 text-sm font-medium transition hover:bg-[#285542]"><UserRound size={16} /><span className="hidden max-w-36 truncate sm:inline">{user.email}</span><LogOut size={15} /></button> : <button type="button" onClick={() => { setAuthMode("login"); setAuthMessage(""); setAuthOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#6d947f] px-3 text-sm font-medium transition hover:bg-[#285542]"><LogIn size={16} /><span className="hidden sm:inline">Ingresar</span></button>}</div>
    </div></header>
    <section className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-8">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#956a31]">Resultados</p><h2 className="mt-1 font-serif text-3xl leading-none tracking-tight sm:text-5xl">Mates para comparar</h2></div><div className="rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] px-4 py-3 text-right shadow-sm"><p className="text-2xl font-semibold tabular-nums">{loading ? "—" : products.length}</p><p className="text-xs text-[#637168]">mates</p></div></div>
      <details className="group mt-4 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#243b2e]"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={17} />Buscar, filtrar y ordenar</span><ChevronDown size={18} className="transition group-open:rotate-180" /></summary>
        <div className="border-t border-[#e2d8c9] p-3 sm:p-4">
        <form onSubmit={(event) => { event.preventDefault(); const term = searchTerm.trim() || "torpedo"; setSelectedType(MATE_TYPES.includes(term.toLowerCase()) ? term.toLowerCase() : "custom"); setLoading(true); void search(term); }} className="grid gap-3 rounded-xl bg-[#f4efe6] p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Tipo de mate</span><select aria-label="Elegir tipo de mate" value={selectedType} onChange={(event) => { const type = event.target.value; setSelectedType(type); if (type !== "custom") { setSearchTerm(type); setLoading(true); void search(type); } }} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]">{MATE_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}<option value="custom">Otro / búsqueda libre</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Buscar mates</span><div className="relative"><Search size={17} className="absolute left-3 top-3 text-[#687269]" /><input aria-label="Buscar mates por tipo, nombre o material" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSelectedType("custom"); }} placeholder="Ej.: torpedo, imperial, cuero negro" className="h-11 w-full rounded-xl border border-[#d7cbb9] bg-white py-2 pl-10 pr-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></div></label>
          <button type="submit" disabled={loading} className="h-11 rounded-xl bg-[#234c3b] px-5 text-sm font-semibold text-white transition hover:bg-[#173b2e] disabled:opacity-60">Buscar</button>
        </form>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Tienda o página</span><select aria-label="Filtrar por tienda o página" value={store} onChange={(event) => setStore(event.target.value)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]">{stores.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Precio desde</span><input inputMode="numeric" type="number" min="0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Sin mínimo" className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Precio hasta</span><input inputMode="numeric" type="number" min="0" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="Sin máximo" className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Ordenar por precio</span><select aria-label="Ordenar por precio" value={priceOrder} onChange={(event) => setPriceOrder(event.target.value as PriceOrder)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]"><option value="featured">Como aparecen</option><option value="lowest">Más baratos</option><option value="highest">Más caros</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-[#566258]"><span>Mis marcas</span><select aria-label="Filtrar por mis marcas" value={markFilter} onChange={(event) => setMarkFilter(event.target.value as MarkFilter)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]"><option value="considering">Me gustan o sin marcar</option><option value="liked">Me gustan</option><option value="disliked">No me gustan</option><option value="unmarked">Sin marcar</option><option value="all">Todos</option></select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#637168]"><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={onlyWithPrice} onChange={(event) => setOnlyWithPrice(event.target.checked)} className="h-4 w-4 accent-[#234c3b]" /> Sólo con precio</label>{user ? <span>Tus marcas se sincronizan con tu cuenta.</span> : <button type="button" onClick={() => { setAuthMode("signup"); setAuthMessage(""); setAuthOpen(true); }} className="underline underline-offset-4 hover:text-[#243b2e]">Creá una cuenta para sincronizar tus marcas.</button>}</div>
        </div>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="truncate text-sm text-[#637168]">{loading ? "Buscando mates…" : `“${data?.query ?? searchTerm}”`}</p><div className="flex items-center gap-2"><div className="inline-flex shrink-0 rounded-xl border border-[#d7cbb9] bg-white p-1" role="group" aria-label="Cantidad de resultados visibles"><button type="button" onClick={() => { setResultsMode("all"); setCurrentPage(1); }} aria-pressed={resultsMode === "all"} className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${resultsMode === "all" ? "bg-[#234c3b] text-white" : "text-[#566258] hover:bg-[#f4efe6]"}`}>Todos</button><button type="button" onClick={() => { setResultsMode("pages"); setCurrentPage(1); }} aria-pressed={resultsMode === "pages"} className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${resultsMode === "pages" ? "bg-[#234c3b] text-white" : "text-[#566258] hover:bg-[#f4efe6]"}`}>Páginas</button></div><div className="inline-flex shrink-0 rounded-xl border border-[#d7cbb9] bg-white p-1" role="group" aria-label="Elegir visualización"><button type="button" onClick={() => setViewMode("list")} aria-label="Vista de lista" aria-pressed={viewMode === "list"} className={`grid h-9 w-9 place-items-center rounded-lg transition ${viewMode === "list" ? "bg-[#234c3b] text-white" : "text-[#566258] hover:bg-[#f4efe6]"}`}><List size={17} /></button><button type="button" onClick={() => setViewMode("grid")} aria-label="Vista de dos columnas" aria-pressed={viewMode === "grid"} className={`grid h-9 w-9 place-items-center rounded-lg transition ${viewMode === "grid" ? "bg-[#234c3b] text-white" : "text-[#566258] hover:bg-[#f4efe6]"}`}><Grid2X2 size={17} /></button><button type="button" onClick={() => setViewMode("dense")} aria-label="Vista de tres columnas" aria-pressed={viewMode === "dense"} className={`grid h-9 w-9 place-items-center rounded-lg transition ${viewMode === "dense" ? "bg-[#234c3b] text-white" : "text-[#566258] hover:bg-[#f4efe6]"}`}><LayoutGrid size={17} /></button></div></div></div>
      {authMessage && <p role="status" className="mt-4 rounded-xl border border-[#cfad75] bg-[#fff7e8] px-4 py-3 text-sm text-[#754c1e]">{authMessage}</p>}
      {authOpen && <div className="mt-5 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="font-serif text-2xl">{authMode === "login" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}</h3><p className="mt-1 text-sm text-[#637168]">Así vas a poder ver tus me gusta desde cualquier dispositivo.</p></div><button type="button" onClick={() => setAuthOpen(false)} className="text-sm underline underline-offset-4">Cerrar</button></div><form onSubmit={submitAuth} className="mt-4 grid max-w-md gap-3"><label className="grid gap-1 text-sm font-medium text-[#566258]">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label><label className="grid gap-1 text-sm font-medium text-[#566258]">Contraseña<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border border-[#d7cbb9] bg-white px-3 font-normal text-[#18271f] outline-none focus:ring-2 focus:ring-[#a97b3d]" /></label><div className="flex flex-wrap items-center gap-4"><button disabled={authLoading} className="rounded-xl bg-[#234c3b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173b2e] disabled:opacity-60">{authLoading ? "Un momento…" : authMode === "login" ? "Ingresar" : "Crear cuenta"}</button><button type="button" onClick={() => { setAuthMode((current) => current === "login" ? "signup" : "login"); setAuthMessage(""); }} className="text-sm font-medium text-[#8a5a20] underline underline-offset-4">{authMode === "login" ? "Quiero crear una cuenta" : "Ya tengo una cuenta"}</button></div></form></div>}
      {loading ? <div className="grid min-h-[320px] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#956a31]" size={31} /><p className="mt-3 text-sm text-[#637168]">Revisando tiendas y disponibilidad…</p></div></div> : products.length ? <><div className={`mt-4 ${productGridClass}`}>{visibleProducts.map((product) => <article key={`${product.store}-${product.url}`} className="group overflow-hidden rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] shadow-[0_2px_0_rgba(23,59,46,0.04)] transition hover:-translate-y-0.5 hover:shadow-md"><div className={`${compactCards ? "aspect-square" : "aspect-[4/3]"} bg-[#e9e1d3]`}>{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-[#968c7d]"><ImageOff size={compactCards ? 20 : 26} /></div>}</div><div className={compactCards ? "p-3" : "p-5"}><div className={`flex items-center justify-between gap-2 ${compactCards ? "mb-2" : "mb-3"}`}><span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-[#4b745c]"><Store size={13} className="mr-1 inline" />{product.store}</span><MarkButtons compact={compactCards} mark={marks[product.url]} onMark={(mark) => setMark(product, mark)} /></div><h3 className={`${compactCards ? "min-h-10 text-base leading-5" : "min-h-12 text-xl leading-6"} font-serif`}>{product.name}</h3><div className={`flex ${compactCards ? "mt-3 flex-col items-start gap-2" : "mt-4 items-end justify-between gap-3"}`}><ProductPrice product={product} compact={compactCards} /><a href={product.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a5a20] underline decoration-[#cfad75] underline-offset-4">{compactCards ? "Ver" : "Ver tienda"} <ExternalLink size={14} /></a></div></div></article>)}</div>{resultsMode === "pages" && totalPages > 1 && <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Paginación de resultados"><button type="button" disabled={activePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-medium disabled:opacity-40"><ChevronLeft size={16} />Anterior</button><span className="text-sm text-[#637168]">Página {activePage} de {totalPages}</span><button type="button" disabled={activePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#d7cbb9] bg-white px-3 text-sm font-medium disabled:opacity-40">Siguiente<ChevronRight size={16} /></button></nav>}</> : <div className="mt-4 rounded-2xl border border-dashed border-[#cabba6] bg-[#fffdf9] px-6 py-16 text-center"><Heart className="mx-auto text-[#956a31]" size={27} /><p className="mt-3 font-serif text-2xl">No hay mates con estos filtros.</p><p className="mt-2 text-sm text-[#637168]">Probá cambiar el precio, la tienda o tus marcas.</p></div>}
      {!loading && data && <details className="mt-5 rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-4 text-sm">
        <summary className="cursor-pointer font-medium">Cobertura de tiendas · {data.completeSources}/{data.totalSources}</summary>
        <p className="mt-3 text-[#637168]">{data.errors.length ? `La búsqueda de “${data.query}” quedó incompleta en algunas tiendas; puede haber más mates disponibles.` : "Se recorrieron las páginas que las tiendas permitieron consultar."} Los productos agotados o sin stock verificable no aparecen.</p>
        {!data.sources.length && <p role="alert" className="mt-3 text-[#8a5a20]">{data.errors.join(" ")}</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{data.sources.map((source) => <li key={source.store} className="rounded-xl bg-[#f4efe6] p-3"><div className="flex flex-wrap justify-between gap-2"><a href={source.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">{source.store}</a><span>{source.products} mates en stock</span></div><p className="mt-1 text-xs text-[#637168]">{source.status === "complete" ? "Búsqueda completa" : source.status === "partial" ? "Búsqueda parcial" : "No se pudo consultar"} · {source.pages} páginas · {source.inspectedProducts} publicaciones revisadas</p>{source.issues.length > 0 && <p className="mt-2 text-xs text-[#8a5a20]">{source.issues.join(" · ")}</p>}</li>)}</ul>
      </details>}
      <footer className="mt-10 flex flex-col gap-2 border-t border-[#d7cbb9] pt-5 text-xs text-[#687269] sm:flex-row sm:items-center sm:justify-between"><span>{data?.checkedSources ?? 0} tiendas consultadas{data?.updatedAt ? ` · actualizado ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}` : ""}</span><span>Precios y stock sujetos a cambios en la tienda.</span></footer>
    </section>
  </main>;
}
