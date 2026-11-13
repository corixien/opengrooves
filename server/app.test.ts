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

  it("owner edit keeps forks, delete requests vanish with the groove", async () => {
    const { groove, token } = await (await call("/grooves", { method: "POST", body: JSON.stringify(sample("Orig")) })).json();
    const fork = (await (await call("/grooves", { method: "POST", body: JSON.stringify(sample("Copy", { forkOf: groove.id })) })).json()).groove;

    const put = (tok: string, body: object) => call(`/grooves/${groove.id}`, { method: "PUT", headers: { "x-owner-token": tok }, body: JSON.stringify(body) });
    expect((await put("nope", sample("Hacked"))).status).toBe(403);
    const edited = await (await put(token, sample("Orig edited", { bpm: 140 }))).json();
    expect(edited.title).toBe("Orig edited");
    expect(edited.bpm).toBe(140);
    const kept = await (await call(`/grooves/${fork.id}`)).json();
    expect(kept.title).toBe("Copy");
    expect(kept.forkOf.title).toBe("Orig"); // snapshot, not changed by the edit

    const ask = (reason: string) => call(`/grooves/${groove.id}/delete-request`, { method: "POST", headers: { "x-client-id": "visitor-123456" }, body: JSON.stringify({ reason }) });
    expect((await ask("spam")).status).toBe(204);
    expect((await ask("still spam")).status).toBe(204); // same visitor: one row, updated
    const rows = await db.query<{ reason: string; groove_url: string }>("select reason, groove_url from delete_requests");
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("still spam");
    expect(rows[0].groove_url).toMatch(new RegExp(`/g/${groove.id}$`));
    expect((await call("/grooves/nothere/delete-request", { method: "POST", headers: { "x-client-id": "visitor-123456" }, body: "{}" })).status).toBe(404);

    await call(`/grooves/${groove.id}`, { method: "DELETE", headers: { "x-owner-token": token } });
    expect(await db.query("select 1 from delete_requests")).toHaveLength(0); // cascade
    expect((await call(`/grooves/${fork.id}`)).status).toBe(200);
  });
});
