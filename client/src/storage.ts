import type { PlayerSettings } from "./audio/engine";
import type { GrooveInput } from "../../shared/groove";

const read = <T,>(key: string): T | null => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
};

export type Theme = "light" | "dark";
export type Draft = Omit<GrooveInput, "forkOf"> & { forkOf: string | null };

export const store = {
  getClientId(): string {
    let id = read<string>("og.client");
    if (!id) {
      id = crypto.randomUUID();
      write("og.client", id);
    }
    return id;
  },
  getToken: (grooveId: string) => read<Record<string, string>>("og.tokens")?.[grooveId] ?? null,
  setToken(grooveId: string, token: string) {
    write("og.tokens", { ...read<Record<string, string>>("og.tokens"), [grooveId]: token });
  },
  removeToken(grooveId: string) {
    const all = { ...read<Record<string, string>>("og.tokens") };
    delete all[grooveId];
    write("og.tokens", all);
  },
  getLang: () => read<"de" | "en">("og.lang"),
  setLang: (l: "de" | "en") => write("og.lang", l),
  getTheme: () => read<Theme>("og.theme"),
  setTheme: (t: Theme) => write("og.theme", t),
  getPlayer: () => read<Partial<PlayerSettings>>("og.player"),
  setPlayer: (p: Partial<PlayerSettings>) => write("og.player", p),
  getDraft: () => read<Draft>("og.draft"),
  setDraft: (d: Draft) => write("og.draft", d),
  clearDraft() {
    localStorage.removeItem("og.draft");
  },
};
