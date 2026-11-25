import dotenv from "dotenv";
import createApp from "./app.js";
import { startDigestScheduler } from "./digests.js";
import { logMailHealth } from "./email.js";
import { closeExpiredAuctions } from "./auctions.js";
import { runMigrations } from "./migrate.js";
import {
  startMpesaRecovery,
  stopMpesaRecovery,
} from "./utils/mpesaRecovery.js";
import { processStoredDarajaCallback } from "./routes/payments.js";

dotenv.config();

const app = createApp();
const port = process.env.PORT || 8080;

const start = async () => {
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
    console.log(`API listening on port ${port}`);
  });

  const stopDigestScheduler = startDigestScheduler();

  // Recover callbacks that were durably stored but not successfully processed.
  startMpesaRecovery(processStoredDarajaCallback);

  // Resolve ended auctions (highest bid wins) on startup and every minute.
  const runAuctionSweep = () =>
    closeExpiredAuctions().catch((error) =>
      console.warn("Auction sweep failed:", error)
    );

  runAuctionSweep();

  const auctionTimer = setInterval(runAuctionSweep, 60_000);

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}, shutting down...`);

    stopDigestScheduler();
    clearInterval(auctionTimer);
    const recoveryDrain = stopMpesaRecovery();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      await recoveryDrain;

      console.log("HTTP server and M-Pesa recovery worker stopped.");
    } catch (error) {
      console.error("Graceful shutdown failed:", error);
      process.exitCode = 1;
    }

    process.exit();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start();
