import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { store } from "./storage";

const de = {
  appTagline: "Schlagzeug-Grooves erstellen, teilen und üben",
  navHome: "Grooves",
  navNew: "Neuer Groove",
  themeLight: "Hell",
  themeDark: "Dunkel",

  // home
  searchPlaceholder: "Grooves suchen (Titel, Name, Beschreibung)",
  filters: "Filter",
  resetFilters: "Zurücksetzen",
  sortBy: "Sortierung",
  sortNew: "Neueste",
  sortPopular: "Beliebteste",
  sortPlayed: "Meistgespielt",
  difficulty: "Schwierigkeit",
  anyDifficulty: "Alle",
  tags: "Genre / Tags",
  focus: "Fokus",
  bpmRange: "Tempo (BPM)",
  barsRange: "Takte",
  from: "von",
  to: "bis",
  results: "Grooves",
  noResults: "Keine Grooves gefunden.",
  emptyHint: "Erstelle den ersten Groove!",
  loadMore: "Mehr laden",
  loading: "Lade ...",
  loadError: "Konnte nicht geladen werden. Läuft der Server?",
  barsCount: "{n} Takte",
  barCount1: "1 Takt",
  by: "von",
  anonymous: "Anonym",
  basedOn: "Basiert auf",

  // difficulty
  beginner: "Anfänger",
  intermediate: "Mittel",
  advanced: "Profi",

  // tags
  rock: "Rock",
  pop: "Pop",
  funk: "Funk",
  jazz: "Jazz",
  blues: "Blues",
  latin: "Latin",
  metal: "Metal",
  hiphop: "Hip-Hop",
  reggae: "Reggae",
  shuffle: "Shuffle",
  fill: "Fill",
  oddMeter: "Ungerader Takt",

  // focus
  hihat: "Hihat-Pattern",
  kick: "Kick-Pattern",
  snare: "Snare / Backbeat",
  feet: "Fußkoordination",
  ghostNotes: "Ghost Notes",
  fills: "Fills",
  dynamics: "Dynamik",
  timing: "Timing",

  // instruments
  inst_crash: "Crash",
  inst_ride: "Ride",
  inst_hhOpen: "HH offen",
  inst_hhClosed: "HH zu",
  inst_tomHigh: "Tom hoch",
  inst_tomMid: "Tom mitte",
  inst_tomLow: "Tom tief",
  inst_snare: "Snare",
  inst_kick: "Kick",

  // editor
  editorTitle: "Neuer Groove",
  editorFork: "Groove kopieren und anpassen",
  fieldTitle: "Titel",
  fieldAuthor: "Dein Name (optional)",
  fieldDescription: "Beschreibung (optional)",
  fieldBpm: "Standard-Tempo",
  brush: "Notenstärke",
  levelGhost: "Leise",
  levelNormal: "Normal",
  levelAccent: "Laut",
  brushHint: "Klicke oder ziehe ins Raster, um Noten zu setzen. Gleiche Stärke nochmal klicken löscht die Note.",
  bar: "Takt",
  beatsPerBar: "Viertel",
  gridSixteenth: "16tel",
  gridTriplet: "Triolen",
  addBar: "Takt hinzufügen",
  maxBars: "Maximal 20 Takte",
  duplicateBar: "Duplizieren",
  clearBar: "Leeren",
  deleteBar: "Löschen",
  publish: "Veröffentlichen",
  publishing: "Veröffentliche ...",
  errTitle: "Bitte gib einen Titel ein.",
  errEmpty: "Setze mindestens eine Note.",
  errRate: "Zu viele Grooves in kurzer Zeit. Bitte warte etwas.",
  errGeneric: "Das hat nicht geklappt. Bitte versuche es erneut.",
  draftRestored: "Entwurf wiederhergestellt.",
  discardDraft: "Neu beginnen",

  // groove page
  notFound: "Groove nicht gefunden.",
  back: "Zurück",
  like: "Gefällt mir",
  liked: "Gefällt dir",
  plays: "Aufrufe",
  forkIt: "Kopieren & ändern",
  deleteGroove: "Löschen",
  confirmDelete: "Diesen Groove wirklich löschen?",
  viewNotes: "Noten",
  viewGrid: "Raster",
  yours: "Dein Groove",

  // player
  play: "Abspielen",
  stop: "Stopp",
  tempo: "Tempo",
  groove: "Groove",
  metronome: "Metronom",
  volume: "Lautstärke",
  countIn: "Vorzähler",
  loop: "Wiederholen",
  clickUnit: "Klick",
  unitQuarter: "Viertel",
  unitEighth: "Achtel",
  unitSixteenth: "16tel",
  loadingSounds: "Lade Sounds ...",
  soundsError: "Sounds konnten nicht geladen werden.",
  countInActive: "Vorzähler",
} as const;

export type Key = keyof typeof de;

const en: Record<Key, string> = {
  appTagline: "Create, share and practise drum grooves",
  navHome: "Grooves",
  navNew: "New groove",
  themeLight: "Light",
  themeDark: "Dark",

  searchPlaceholder: "Search grooves (title, name, description)",
  filters: "Filters",
  resetFilters: "Reset",
  sortBy: "Sort by",
  sortNew: "Newest",
  sortPopular: "Most liked",
  sortPlayed: "Most played",
  difficulty: "Difficulty",
  anyDifficulty: "Any",
  tags: "Genre / tags",
  focus: "Focus",
  bpmRange: "Tempo (BPM)",
  barsRange: "Bars",
  from: "from",
  to: "to",
  results: "grooves",
  noResults: "No grooves found.",
  emptyHint: "Create the first groove!",
  loadMore: "Load more",
  loading: "Loading ...",
  loadError: "Could not load. Is the server running?",
  barsCount: "{n} bars",
  barCount1: "1 bar",
  by: "by",
  anonymous: "Anonymous",
  basedOn: "Based on",

  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",

  rock: "Rock",
  pop: "Pop",
  funk: "Funk",
  jazz: "Jazz",
  blues: "Blues",
  latin: "Latin",
  metal: "Metal",
  hiphop: "Hip-hop",
  reggae: "Reggae",
  shuffle: "Shuffle",
  fill: "Fill",
  oddMeter: "Odd meter",

  hihat: "Hi-hat pattern",
  kick: "Kick pattern",
  snare: "Snare / backbeat",
  feet: "Foot coordination",
  ghostNotes: "Ghost notes",
  fills: "Fills",
  dynamics: "Dynamics",
  timing: "Timing",

  inst_crash: "Crash",
  inst_ride: "Ride",
  inst_hhOpen: "HH open",
  inst_hhClosed: "HH closed",
  inst_tomHigh: "Tom high",
  inst_tomMid: "Tom mid",
  inst_tomLow: "Tom low",
  inst_snare: "Snare",
  inst_kick: "Kick",

  editorTitle: "New groove",
  editorFork: "Copy and adapt groove",
  fieldTitle: "Title",
  fieldAuthor: "Your name (optional)",
  fieldDescription: "Description (optional)",
  fieldBpm: "Default tempo",
  brush: "Note strength",
  levelGhost: "Soft",
  levelNormal: "Normal",
  levelAccent: "Loud",
  brushHint: "Click or drag in the grid to place notes. Clicking a note of the same strength removes it.",
  bar: "Bar",
  beatsPerBar: "Beats",
  gridSixteenth: "16ths",
  gridTriplet: "Triplets",
  addBar: "Add bar",
  maxBars: "20 bars maximum",
  duplicateBar: "Duplicate",
  clearBar: "Clear",
  deleteBar: "Delete",
  publish: "Publish",
  publishing: "Publishing ...",
  errTitle: "Please enter a title.",
  errEmpty: "Place at least one note.",
  errRate: "Too many grooves in a short time. Please wait a bit.",
  errGeneric: "That did not work. Please try again.",
  draftRestored: "Draft restored.",
  discardDraft: "Start over",

  notFound: "Groove not found.",
  back: "Back",
  like: "Like",
  liked: "Liked",
  plays: "plays",
  forkIt: "Copy & edit",
  deleteGroove: "Delete",
  confirmDelete: "Really delete this groove?",
  viewNotes: "Notation",
  viewGrid: "Grid",
  yours: "Your groove",

  play: "Play",
  stop: "Stop",
  tempo: "Tempo",
  groove: "Groove",
  metronome: "Metronome",
  volume: "Volume",
  countIn: "Count-in",
  loop: "Loop",
  clickUnit: "Click",
  unitQuarter: "Quarter",
  unitEighth: "Eighth",
  unitSixteenth: "16th",
  loadingSounds: "Loading sounds ...",
  soundsError: "Could not load sounds.",
  countInActive: "Count-in",
};

const dicts = { de, en } as const;
export type Lang = keyof typeof dicts;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
}
const I18nContext = createContext<Ctx>(null as never);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => store.getLang() ?? (navigator.language.startsWith("de") ? "de" : "en"));
  useEffect(() => {
    document.documentElement.lang = lang;
    store.setLang(lang);
  }, [lang]);
  const t: Ctx["t"] = (key, vars) => {
    let s: string = dicts[lang][key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
