import dotenv from "dotenv";
import createApp from "./app.js";
import { startDigestScheduler } from "./digests.js";
import { logMailHealth } from "./email.js";

dotenv.config();

const app = createApp();
const port = process.env.PORT || 8080;
logMailHealth();

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

const stopDigestScheduler = startDigestScheduler();

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  stopDigestScheduler();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
