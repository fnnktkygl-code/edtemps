import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis pour exécuter les migrations.");

const migrationDirectory = new URL("../../../infra/postgres/", import.meta.url);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const alreadyApplied = await pool.query("select 1 from schema_migrations where name = $1", [file]);
    if (alreadyApplied.rowCount) continue;
    const sql = await readFile(join(migrationDirectory.pathname, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.info(`Migration appliquée : ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }
} finally {
  await pool.end();
}
