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

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
  : "*";

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static("uploads"));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
