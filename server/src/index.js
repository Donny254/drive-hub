import dotenv from "dotenv";
import createApp from "./app.js";
import { startDigestScheduler } from "./digests.js";
import { logMailHealth } from "./email.js";
import { closeExpiredAuctions } from "./auctions.js";
import { runMigrations } from "./migrate.js";

dotenv.config();

const app = createApp();
const port = process.env.PORT || 8080;

const start = async () => {
  // Bring the database schema up to date before serving any requests.
  try {
    await runMigrations();
    console.log("Database schema is up to date.");
  } catch (error) {
    console.error("Database migration failed, server not started:", error);
    process.exit(1);
    return;
  }

  logMailHealth();

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  const stopDigestScheduler = startDigestScheduler();

  // Resolve ended auctions (highest bid wins) on startup and every minute.
  const runAuctionSweep = () =>
    closeExpiredAuctions().catch((error) => console.warn("Auction sweep failed:", error));
  runAuctionSweep();
  const auctionTimer = setInterval(runAuctionSweep, 60_000);

  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    stopDigestScheduler();
    clearInterval(auctionTimer);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start();
