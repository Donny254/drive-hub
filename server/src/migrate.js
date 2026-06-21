import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import pool, { withTransaction, connectionString, sslConfig } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, "..", "db", "schema.sql");
const MIGRATIONS_DIR = path.join(here, "..", "db", "migrations");

// Create the target database itself if it doesn't exist yet, by connecting to
// the "postgres" maintenance database on the same server. Postgres has no
// CREATE DATABASE IF NOT EXISTS, so we check pg_database first.
const ensureDatabase = async () => {
  const url = new URL(connectionString);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!dbName || dbName === "postgres") return;

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString(), ssl: sslConfig });
  try {
    await client.connect();
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount === 0) {
      // dbName comes from our own config; double-quote to form a safe identifier.
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}".`);
    }
  } catch (error) {
    // If we can't reach the maintenance DB, fall through — applyBaseSchema will
    // surface a clear error if the target database is genuinely unavailable.
    console.warn(`Could not ensure database "${dbName}" exists:`, error.message);
  } finally {
    await client.end().catch(() => undefined);
  }
};

// The base schema is fully idempotent (CREATE ... IF NOT EXISTS,
// ADD COLUMN IF NOT EXISTS, etc.) so applying it on every boot brings any
// drifted database up to date without manual steps.
const applyBaseSchema = async () => {
  const sql = await fs.readFile(SCHEMA_PATH, "utf8");
  await pool.query(sql);
};

const ensureMigrationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const listMigrationFiles = async () => {
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    return entries.filter((file) => file.endsWith(".sql")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const appliedMigrations = async () => {
  const result = await pool.query("SELECT name FROM schema_migrations");
  return new Set(result.rows.map((row) => row.name));
};

// Apply the base schema, then run any ordered migration files in
// server/db/migrations that haven't been applied yet (tracked in
// schema_migrations). Each migration runs in its own transaction.
export const runMigrations = async () => {
  await ensureDatabase();
  await applyBaseSchema();
  await ensureMigrationsTable();

  const files = await listMigrationFiles();
  const applied = await appliedMigrations();
  const pending = files.filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    console.log(`Migration applied: ${file}`);
  }

  return { pending };
};
