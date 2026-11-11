import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type FocusOption } from "./api";
import { useI18n } from "./i18n";

interface Ctx {
  /** Focus choices with labels in the current language (DB-driven, admin-editable). */
  focus: { id: string; label: string }[];
  focusLabel: (id: string) => string;
}
const OptionsContext = createContext<Ctx>({ focus: [], focusLabel: (id) => id });

export function OptionsProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [raw, setRaw] = useState<FocusOption[]>([]);
  useEffect(() => {
    api.options().then((o) => setRaw(o.focus), () => {});
  }, []);
  const value = useMemo<Ctx>(() => {
    const focus = raw.map((o) => ({ id: o.id, label: o[lang] || o.de || o.en || o.id }));
    const byId = new Map(focus.map((f) => [f.id, f.label]));
    return { focus, focusLabel: (id) => byId.get(id) ?? id };
  }, [raw, lang]);
  return <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>;
}

export const useOptions = () => useContext(OptionsContext);
