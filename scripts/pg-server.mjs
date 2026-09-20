/* Dev-only: runs an embedded Postgres instance for the app.
   Not part of the product — used so the repo runs standalone in a sandbox. */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const defaultDbDir = fileURLToPath(new URL("../.pgdata", import.meta.url));
const dbDir = process.env.PG_DATA_DIR ?? defaultDbDir;
const port = Number(process.env.PG_PORT ?? 5432);

mkdirSync(dbDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

await pg.initialise();
await pg.start();
await pg.createDatabase("app_db").catch(() => {});
console.log(`[pg] ready on 127.0.0.1:${port} (db: app_db)`);

// keep alive
setInterval(() => {}, 60_000);
