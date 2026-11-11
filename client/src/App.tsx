import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useI18n } from "./i18n";
import { EditorPage } from "./pages/EditorPage";
import { GroovePage } from "./pages/GroovePage";
import { Home } from "./pages/Home";
import { store, type Theme } from "./storage";

function initialTheme(): Theme {
  return store.getTheme() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.setTheme(theme);
  }, [theme]);

  return (
    <>
      <header className="topbar">
        <div className="container bar">
          <Link to="/" className="logo">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
              <rect className="bg" width="32" height="32" rx="8" />
              <rect x="7" y="9" width="4.5" height="14" rx="1" />
              <rect x="13.75" y="13" width="4.5" height="10" rx="1" />
              <rect x="20.5" y="11" width="4.5" height="12" rx="1" />
            </svg>
            Open<b>grooves</b>
          </Link>
          <nav>
            <NavLink to="/" end>{t("navHome")}</NavLink>
            <NavLink to="/new">{t("navNew")}</NavLink>
          </nav>
          <span className="spacer" />
          <button className="btn small" onClick={() => setLang(lang === "de" ? "en" : "de")} aria-label="Language">
            {lang === "de" ? "EN" : "DE"}
          </button>
          <button className="btn small" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? t("themeLight") : t("themeDark")}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<EditorPage />} />
        <Route path="/g/:id" element={<GroovePage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
