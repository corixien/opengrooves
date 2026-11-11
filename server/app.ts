import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import express, { type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { DIFFICULTIES, FOCUS, TAGS, grooveInputSchema, type Groove } from "../shared/groove.ts";
import type { Db } from "./db.ts";

interface Row {
  id: string;
  title: string;
  author: string;
  description: string;
  tags: Groove["tags"];
  difficulty: Groove["difficulty"];
  focus: Groove["focus"];
  bpm: number;
  bars: Groove["bars"];
  fork_of: string | null;
  fork_title: string | null;
  plays: number;
  likes: number;
  created_at: Date | string;
}

const COLUMNS =
  "id,title,author,description,tags,difficulty,focus,bpm,bars,fork_of,fork_title,plays,likes,created_at";

function toGroove(r: Row): Groove {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    description: r.description,
    tags: r.tags,
    difficulty: r.difficulty,
    focus: r.focus,
    bpm: r.bpm,
    bars: r.bars,
    forkOf: r.fork_of && r.fork_title ? { id: r.fork_of, title: r.fork_title } : null,
    plays: r.plays,
    likes: r.likes,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const newId = () => randomBytes(5).toString("base64url");

const csv = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : []))
    .pipe(z.array(z.enum(values as [T, ...T[]])));

const listQuery = z.object({
  q: z.string().trim().max(80).default(""),
  tags: csv(TAGS),
  focus: csv(FOCUS),
  difficulty: z.enum(DIFFICULTIES).optional(),
  minBpm: z.coerce.number().int().min(0).optional(),
  maxBpm: z.coerce.number().int().min(0).optional(),
  minBars: z.coerce.number().int().min(1).optional(),
  maxBars: z.coerce.number().int().max(20).optional(),
  sort: z.enum(["new", "popular", "played"]).default("new"),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 24;
const ORDER = {
  new: "created_at desc",
  popular: "likes desc, created_at desc",
  played: "plays desc, created_at desc",
};

const clientIdSchema = z.string().min(8).max(64);

export function createApp(db: Db) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200kb" }));

  const api = express.Router();

  const createLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });
  const actionLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });

  api.get("/grooves", async (req, res) => {
    const p = listQuery.parse(req.query);
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => `$${args.push(v)}`;
    if (p.q) {
      const like = arg(`%${p.q.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`(title ilike ${like} or author ilike ${like} or description ilike ${like})`);
    }
    if (p.tags.length) where.push(`tags @> ${arg(JSON.stringify(p.tags))}::jsonb`);
    if (p.focus.length) where.push(`focus @> ${arg(JSON.stringify(p.focus))}::jsonb`);
    if (p.difficulty) where.push(`difficulty = ${arg(p.difficulty)}`);
    if (p.minBpm !== undefined) where.push(`bpm >= ${arg(p.minBpm)}`);
    if (p.maxBpm !== undefined) where.push(`bpm <= ${arg(p.maxBpm)}`);
    if (p.minBars !== undefined) where.push(`bar_count >= ${arg(p.minBars)}`);
    if (p.maxBars !== undefined) where.push(`bar_count <= ${arg(p.maxBars)}`);
    const w = where.length ? `where ${where.join(" and ")}` : "";
    const [{ n }] = await db.query<{ n: number | string }>(
      `select count(*)::int as n from grooves ${w}`,
      args,
    );
    const rows = await db.query<Row>(
      `select ${COLUMNS} from grooves ${w} order by ${ORDER[p.sort]} limit ${PAGE_SIZE} offset ${(p.page - 1) * PAGE_SIZE}`,
      args,
    );
    res.json({ items: rows.map(toGroove), total: Number(n), pageSize: PAGE_SIZE });
  });

  api.get("/grooves/:id", async (req, res) => {
    const rows = await db.query<Row>(`select ${COLUMNS} from grooves where id = $1`, [req.params.id]);
    if (!rows[0]) return void res.status(404).json({ error: "not_found" });
    res.json(toGroove(rows[0]));
  });

  api.post("/grooves", createLimit, async (req, res) => {
    const g = grooveInputSchema.parse(req.body);
    let forkTitle: string | null = null;
    let forkOf: string | null = null;
    if (g.forkOf) {
      const o = await db.query<{ id: string; title: string }>(
        "select id, title from grooves where id = $1",
        [g.forkOf],
      );
      if (o[0]) {
        forkOf = o[0].id;
        forkTitle = o[0].title;
      }
    }
    const token = randomUUID();
    const id = newId();
    const rows = await db.query<Row>(
      `insert into grooves (id,title,author,description,tags,difficulty,focus,bpm,bars,bar_count,owner_hash,fork_of,fork_title)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13) returning ${COLUMNS}`,
      [
        id,
        g.title,
        g.author,
        g.description,
        JSON.stringify(g.tags),
        g.difficulty,
        JSON.stringify(g.focus),
        g.bpm,
        JSON.stringify(g.bars),
        g.bars.length,
        hash(token),
        forkOf,
        forkTitle,
      ],
    );
    res.status(201).json({ groove: toGroove(rows[0]), token });
  });

  api.delete("/grooves/:id", actionLimit, async (req, res) => {
    const token = req.get("x-owner-token") ?? "";
    const rows = await db.query<{ id: string }>(
      "delete from grooves where id = $1 and owner_hash = $2 returning id",
      [req.params.id, hash(token)],
    );
    if (!rows[0]) return void res.status(403).json({ error: "forbidden" });
    res.status(204).end();
  });

  api.post("/grooves/:id/play", actionLimit, async (req, res) => {
    await db.query("update grooves set plays = plays + 1 where id = $1", [req.params.id]);
    res.status(204).end();
  });

  const setLike = (on: boolean) => async (req: Request, res: Response) => {
    const clientId = clientIdSchema.parse(req.get("x-client-id"));
    const id = String(req.params.id);
    const exists = await db.query("select 1 from grooves where id = $1", [id]);
    if (!exists[0]) return void res.status(404).json({ error: "not_found" });
    if (on) {
      await db.query("insert into likes (groove_id, client_id) values ($1,$2) on conflict do nothing", [id, clientId]);
    } else {
      await db.query("delete from likes where groove_id = $1 and client_id = $2", [id, clientId]);
    }
    const rows = await db.query<{ likes: number }>(
      "update grooves set likes = (select count(*)::int from likes where groove_id = $1) where id = $1 returning likes",
      [id],
    );
    res.json({ likes: rows[0].likes });
  };
  api.put("/grooves/:id/like", actionLimit, setLike(true));
  api.delete("/grooves/:id/like", actionLimit, setLike(false));

  api.post("/likes/mine", actionLimit, async (req, res) => {
    const clientId = clientIdSchema.parse(req.get("x-client-id"));
    const rows = await db.query<{ groove_id: string }>(
      "select groove_id from likes where client_id = $1",
      [clientId],
    );
    res.json(rows.map((r) => r.groove_id));
  });

  app.use("/api", api);

  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) return void res.status(400).json({ error: "invalid", issues: err.issues });
    console.error(err);
    res.status(500).json({ error: "server_error" });
  });

  return app;
}
