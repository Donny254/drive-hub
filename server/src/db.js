import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const { Pool } = pg;

// Fall back to a local Postgres when no DATABASE_URL is configured, so the app
// works out of the box for local development.
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/wheelsnationke";

export const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

const buildSslConfig = () => {
  if (process.env.PGSSL !== "true") {
    return undefined;
  }

  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED !== "false";
  const ca =
    process.env.PGSSL_CA ||
    (process.env.PGSSL_CA_FILE ? fs.readFileSync(process.env.PGSSL_CA_FILE, "utf8") : undefined);

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
};

export const sslConfig = buildSslConfig();

const pool = new Pool({
  connectionString,
  ssl: sslConfig,
});

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default pool;
