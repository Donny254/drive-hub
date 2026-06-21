import dotenv from "dotenv";
import { runMigrations } from "../src/migrate.js";
import pool from "../src/db.js";

dotenv.config();

runMigrations()
  .then(({ pending }) => {
    console.log(
      pending.length ? `Migrations complete. Applied: ${pending.join(", ")}` : "Schema up to date. No new migrations."
    );
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
