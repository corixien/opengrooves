import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DIFFICULTIES, TAGS, type Groove } from "../../../shared/groove";
import { api, type ListFilters } from "../api";
import { engine } from "../audio/engine";
import { store } from "../storage";
import { Chips } from "../components/Chips";
import { GrooveCard } from "../components/GrooveCard";
import { Select } from "../components/Select";
import { useOptions } from "../options";
import { useI18n, type Key } from "../i18n";

const EMPTY: ListFilters = {
  q: "",
  tags: [],
  focus: [],
  difficulty: "",
  minBpm: "",
  maxBpm: "",
  minBars: "",
  maxBars: "",
  sort: "new",
};

export function Home() {
  const { t } = useI18n();
  const { focus } = useOptions();
  const [f, setF] = useState<ListFilters>(EMPTY);
  const [qInput, setQInput] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Groove[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const req = useRef(0);
  const [vol, setVol] = useState(() => store.getVolume().grooveVol);
  const changeVol = (v: number) => {
    setVol(v);
    store.setVolume({ ...store.getVolume(), grooveVol: v });
    engine.settings = { ...engine.settings, grooveVol: v };
  };

  useEffect(() => {
    const id = setTimeout(() => setF((x) => (x.q === qInput ? x : { ...x, q: qInput })), 250);
    return () => clearTimeout(id);
  }, [qInput]);

  const load = (filters: ListFilters, p: number) => {
    const my = ++req.current;
    setState("loading");
    api.list(filters, p).then(
      (r) => {
        if (my !== req.current) return;
        setItems((cur) => (p === 1 ? r.items : [...cur, ...r.items]));
        setTotal(r.total);
        setPage(p);
        setState("ok");
      },
      () => my === req.current && setState("error"),
    );
  };
  useEffect(() => load(f, 1), [f]);

  const set = (patch: Partial<ListFilters>) => setF((x) => ({ ...x, ...patch }));
  const active =
    f.tags.length + f.focus.length + [f.difficulty, f.minBpm, f.maxBpm, f.minBars, f.maxBars].filter(Boolean).length;
  const reset = () => {
    setQInput("");
    setF(EMPTY);
  };

  return (
    <main className="container">
      <section className="toolbar">
        <input
          className="search"
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        <Select
          className="sort"
          label={t("sortBy")}
          value={f.sort}
          onChange={(sort) => set({ sort })}
          options={[
            { value: "new", label: t("sortNew") },
            { value: "popular", label: t("sortPopular") },
            { value: "played", label: t("sortPlayed") },
          ]}
        />
        <button className={`btn${open ? " active" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {t("filters")}
          {active > 0 && <b className="badge">{active}</b>}
        </button>
      </section>

      {open && (
        <section className="filters">
          <div className="filter-group">
            <h4>{t("tags")}</h4>
            <Chips options={TAGS.map((id) => ({ id, label: t(id as Key) }))} value={f.tags} onChange={(v) => set({ tags: v })} />
          </div>
          <div className="filter-group">
            <h4>{t("focus")}</h4>
            <Chips options={focus} value={f.focus} onChange={(v) => set({ focus: v })} />
          </div>
          <div className="filter-row">
            <div className="field">
              <span>{t("difficulty")}</span>
              <Select
                label={t("difficulty")}
                value={f.difficulty}
                onChange={(difficulty) => set({ difficulty })}
                options={[
                  { value: "", label: t("anyDifficulty") },
                  ...DIFFICULTIES.map((d) => ({ value: d as string, label: t(d as Key) })),
                ]}
              />
            </div>
            <div className="field">
              <span>{t("bpmRange")}</span>
              <div className="range">
                <input type="number" min={0} placeholder={t("from")} value={f.minBpm} onChange={(e) => set({ minBpm: e.target.value })} />
                <input type="number" min={0} placeholder={t("to")} value={f.maxBpm} onChange={(e) => set({ maxBpm: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <span>{t("barsRange")}</span>
              <div className="range">
                <input type="number" min={1} max={20} placeholder={t("from")} value={f.minBars} onChange={(e) => set({ minBars: e.target.value })} />
                <input type="number" min={1} max={20} placeholder={t("to")} value={f.maxBars} onChange={(e) => set({ maxBars: e.target.value })} />
              </div>
            </div>
            <button className="btn" onClick={reset}>
              {t("resetFilters")}
            </button>
          </div>
        </section>
      )}

      <div className="listbar">
        <p className="muted count">{state === "ok" || items.length ? `${total} ${t("results")}` : ""}</p>
        <label className="volume" title={t("volume")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
            <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" />
          </svg>
          <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => changeVol(Number(e.target.value))} aria-label={t("volume")} />
        </label>
      </div>

      {state === "error" && <p className="notice error">{t("loadError")}</p>}
      {state === "ok" && items.length === 0 && (
        <div className="empty">
          <p>{t("noResults")}</p>
          <Link to="/new" className="btn primary">
            {t("emptyHint")}
          </Link>
        </div>
      )}

      <div className="cards">
        {items.map((g) => (
          <GrooveCard key={g.id} g={g} />
        ))}
      </div>

      {state === "loading" && <p className="muted">{t("loading")}</p>}
      {state === "ok" && items.length < total && (
        <button className="btn more" onClick={() => load(f, page + 1)}>
          {t("loadMore")}
        </button>
      )}
    </main>
  );
}
