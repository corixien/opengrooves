import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdirSync } from "node:fs";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const SCHEMA = `
create table if not exists grooves (
  id text primary key,
  title text not null,
  author text not null default '',
  description text not null default '',
  tags jsonb not null default '[]',
  difficulty text not null,
  focus jsonb not null default '[]',
  bpm int not null,
  bars jsonb not null,
  bar_count int not null,
  owner_hash text not null,
  fork_of text references grooves(id) on delete set null,
  fork_title text,
  plays int not null default 0,
  likes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists grooves_created_idx on grooves (created_at desc);
create table if not exists focus_options (
  id text primary key,
  label_de text not null,
  label_en text not null,
  sort int not null default 0
);
-- Deletion requests from visitors. Admin (Neon): open groove_url, delete the groove in "grooves"
-- (its requests disappear with it), or just delete the request row to dismiss it.
create table if not exists delete_requests (
  id bigint generated always as identity primary key,
  groove_id text not null references grooves(id) on delete cascade,
  groove_title text not null,
  groove_url text not null,
  client_id text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (groove_id, client_id)
);
create table if not exists likes (
  groove_id text not null references grooves(id) on delete cascade,
  client_id text not null,
  primary key (groove_id, client_id)
);
`;

const DEFAULT_FOCUS: [string, string, string][] = [
  ["hihat", "Hihat-Pattern", "Hi-hat pattern"],
  ["kick", "Kick-Pattern", "Kick pattern"],
  ["snare", "Snare / Backbeat", "Snare / backbeat"],
  ["feet", "Fußkoordination", "Foot coordination"],
  ["ghostNotes", "Ghost Notes", "Ghost notes"],
  ["fills", "Fills", "Fills"],
  ["dynamics", "Dynamik", "Dynamics"],
  ["timing", "Timing", "Timing"],
  ["independence", "Unabhängigkeit", "Limb independence"],
  ["ride", "Ride-Pattern", "Ride pattern"],
  ["openHihat", "Offene Hihat", "Open hi-hat"],
  ["linear", "Lineare Grooves", "Linear grooves"],
  ["accents", "Akzente", "Accents"],
  ["speed", "Geschwindigkeit", "Speed"],
  ["endurance", "Ausdauer", "Endurance"],
  ["polyrhythm", "Polyrhythmik", "Polyrhythms"],
  ["tomPatterns", "Tom-Patterns", "Tom patterns"],
  ["doubleKick", "Doppelkick", "Double kick"],
];

/** DATABASE_URL -> Postgres (Neon etc.); otherwise embedded PGlite (dir, or in-memory when dir is ":memory:"). */
export async function openDb(databaseUrl?: string, pgliteDir = "data/pglite"): Promise<Db> {
  let db: Db;
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    db = {
      query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
      exec: async (sql) => void (await pool.query(sql)),
      close: () => pool.end(),
    };
  } else {
    if (pgliteDir !== ":memory:") mkdirSync(pgliteDir, { recursive: true });
    const lite = new PGlite(pgliteDir === ":memory:" ? undefined : pgliteDir);
    await lite.waitReady;
    db = {
      query: async <T,>(sql: string, params?: unknown[]) =>
        (await lite.query<T>(sql, params as unknown[])).rows,
      exec: async (sql) => void (await lite.exec(sql)),
      close: () => lite.close(),
    };
  }
  await db.exec(SCHEMA);
  // Defaults are only inserted when missing, so admin edits in the DB survive restarts.
  // Admins add rows to focus_options (id, label_de, label_en, sort) to offer new focus choices.
  for (const [i, [id, de, en]] of DEFAULT_FOCUS.entries()) {
    await db.query(
      "insert into focus_options (id, label_de, label_en, sort) values ($1,$2,$3,$4) on conflict (id) do nothing",
      [id, de, en, (i + 1) * 10],
    );
  }
  return db;
}
