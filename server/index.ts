import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const port = Number(process.env.PORT ?? 3001);
const db = await openDb(process.env.DATABASE_URL || undefined);
createApp(db).listen(port, () => {
  console.log(`Opengrooves API on http://localhost:${port} (${process.env.DATABASE_URL ? "postgres" : "pglite"})`);
});
