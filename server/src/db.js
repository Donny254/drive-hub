import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const { Pool } = pg;

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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
});

export const query = (text, params) => pool.query(text, params);

export default pool;
