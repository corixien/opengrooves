import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DIFFICULTIES, FOCUS, TAGS, type Groove } from "../../../shared/groove";
import { api, type ListFilters } from "../api";
import { Chips } from "../components/Chips";
import { GrooveCard } from "../components/GrooveCard";
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
  const [f, setF] = useState<ListFilters>(EMPTY);
  const [qInput, setQInput] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Groove[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const req = useRef(0);

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
        <select value={f.sort} onChange={(e) => set({ sort: e.target.value as ListFilters["sort"] })} aria-label={t("sortBy")}>
          <option value="new">{t("sortNew")}</option>
          <option value="popular">{t("sortPopular")}</option>
          <option value="played">{t("sortPlayed")}</option>
        </select>
        <button className={`btn${open ? " active" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {t("filters")}
          {active > 0 && <b className="badge">{active}</b>}
        </button>
      </section>

      {open && (
        <section className="filters">
          <div className="filter-group">
            <h4>{t("tags")}</h4>
            <Chips options={TAGS} value={f.tags as (typeof TAGS)[number][]} onChange={(v) => set({ tags: v })} />
          </div>
          <div className="filter-group">
            <h4>{t("focus")}</h4>
            <Chips options={FOCUS} value={f.focus as (typeof FOCUS)[number][]} onChange={(v) => set({ focus: v })} />
          </div>
          <div className="filter-row">
            <label className="field">
              <span>{t("difficulty")}</span>
              <select value={f.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                <option value="">{t("anyDifficulty")}</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {t(d as Key)}
                  </option>
                ))}
              </select>
            </label>
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

      <p className="muted count">
        {state === "ok" || items.length ? `${total} ${t("results")}` : ""}
      </p>

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
