import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.ts";
import { openDb, type Db } from "./db.ts";
import { emptyBar, setLevel } from "../shared/groove.ts";

let db: Db;
let server: Server;
let base: string;

beforeAll(async () => {
  db = await openDb(undefined, ":memory:");
  await new Promise<void>((r) => {
    server = createApp(db).listen(0, () => r());
  });
  base = `http://localhost:${(server.address() as { port: number }).port}/api`;
});
afterAll(async () => {
  server.close();
  await db.close();
});

const call = (p: string, init?: RequestInit) =>
  fetch(base + p, { ...init, headers: { "content-type": "application/json", ...init?.headers } });

const sample = (title: string, extra: object = {}) => ({
  title,
  difficulty: "beginner",
  bpm: 100,
  tags: ["rock"],
  focus: ["hihat"],
  bars: [setLevel(setLevel(emptyBar(), "kick", 0, 2), "snare", 8, 2)],
  ...extra,
});

describe("grooves api", () => {
  it("create, list, filter, search, like, fork, delete", async () => {
    const r = await call("/grooves", { method: "POST", body: JSON.stringify(sample("Basic Rock")) });
    expect(r.status).toBe(201);
    const { groove, token } = await r.json();
    expect(groove.bars[0].rows.kick).toBe("2---------------");

    await call("/grooves", { method: "POST", body: JSON.stringify(sample("Funk Thing", { tags: ["funk"] })) });

    let list = await (await call("/grooves?tags=funk")).json();
    expect(list.items.map((g: { title: string }) => g.title)).toEqual(["Funk Thing"]);
    list = await (await call("/grooves?q=basic")).json();
    expect(list.total).toBe(1);

    const like = await call(`/grooves/${groove.id}/like`, { method: "PUT", headers: { "x-client-id": "client-abc-123" } });
    expect((await like.json()).likes).toBe(1);
    const like2 = await call(`/grooves/${groove.id}/like`, { method: "PUT", headers: { "x-client-id": "client-abc-123" } });
    expect((await like2.json()).likes).toBe(1);

    const fork = await (
      await call("/grooves", { method: "POST", body: JSON.stringify(sample("Rock v2", { forkOf: groove.id })) })
    ).json();
    expect(fork.groove.forkOf.title).toBe("Basic Rock");
    expect((await (await call(`/grooves/${groove.id}`)).json()).forks).toBe(1);

    expect((await call(`/grooves/${groove.id}`, { method: "DELETE", headers: { "x-owner-token": "nope" } })).status).toBe(403);
    expect((await call(`/grooves/${groove.id}`, { method: "DELETE", headers: { "x-owner-token": token } })).status).toBe(204);
    const after = await (await call(`/grooves/${fork.groove.id}`)).json();
    expect(after.forkOf).toBeNull();
  });

  it("serves focus options from the db and rejects unknown ids", async () => {
    const opts = await (await call("/options")).json();
    expect(opts.focus.find((f: { id: string }) => f.id === "hihat")).toMatchObject({ de: "Hihat-Pattern", en: "Hi-hat pattern" });

    await db.query("insert into focus_options (id,label_de,label_en,sort) values ('custom','Eigener','Custom',999)");
    expect((await call("/grooves", { method: "POST", body: JSON.stringify(sample("c1", { focus: ["custom"] })) })).status).toBe(201);
    expect((await call("/grooves", { method: "POST", body: JSON.stringify(sample("c2", { focus: ["nope"] })) })).status).toBe(400);
    const list = await (await call("/grooves?focus=custom")).json();
    expect(list.total).toBe(1);
  });

  it("rejects invalid bars", async () => {
    const bad = sample("x", { bars: [{ beats: 4, triplet: false, rows: { kick: "22" } }] });
    expect((await call("/grooves", { method: "POST", body: JSON.stringify(bad) })).status).toBe(400);
  });
});
