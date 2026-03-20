import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import listingsRouter from "./routes/listings.js";
import authRouter from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import ordersRouter from "./routes/orders.js";
import usersRouter from "./routes/users.js";
import uploadsRouter from "./routes/uploads.js";
import servicesRouter from "./routes/services.js";
import eventsRouter from "./routes/events.js";
import productsRouter from "./routes/products.js";
import postsRouter from "./routes/posts.js";
import paymentsRouter from "./routes/payments.js";
import serviceBookingsRouter from "./routes/serviceBookings.js";
import eventRegistrationsRouter from "./routes/eventRegistrations.js";
import inquiriesRouter from "./routes/inquiries.js";
import settingsRouter from "./routes/settings.js";
import { startDigestScheduler } from "./digests.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === "production";

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter((envKey) => !process.env[envKey]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
  : [];

if (isProduction && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN is required in production");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients and same-origin server-to-server requests.
      if (!origin) return callback(null, true);
      if (!isProduction) {
        const isLocalDevOrigin =
          /^https?:\/\/localhost(?::\d+)?$/.test(origin) ||
          /^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin) ||
          /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin) ||
          /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin) ||
          /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin);

        if (allowedOrigins.length === 0 || isLocalDevOrigin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static("uploads"));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.get("/", (req, res) => {
  res.json({ name: "drive-hub-api", status: "ok" });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/users", usersRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/products", productsRouter);
app.use("/api/posts", postsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/service-bookings", serviceBookingsRouter);
app.use("/api/event-registrations", eventRegistrationsRouter);
app.use("/api/inquiries", inquiriesRouter);
app.use("/api/settings", settingsRouter);
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

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
