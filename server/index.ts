import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const port = Number(process.env.PORT ?? 3001);
const db = await openDb(process.env.DATABASE_URL || undefined);
const server = createApp(db).listen(port, () => {
  console.log(`Opengrooves API on http://localhost:${port} (${process.env.DATABASE_URL ? "postgres" : "pglite"})`);
});

// Close the embedded DB cleanly so a watch-restart cannot corrupt ./data.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    server.close();
    void db.close().finally(() => process.exit(0));
  });
}
