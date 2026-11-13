import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import registrationRoutes from "./routes/registrations.js";
import attendanceRoutes from "./routes/attendance.js";

const app = express();

// Hosting services put a proxy in front of the app; this lets the
// rate limiter see each visitor's real address.
app.set("trust proxy", 1);

// Adds safe default security headers to every answer.
app.use(helmet());

// Only our own website may call this API from a browser.
// CLIENT_URL can hold several addresses separated by commas (no trailing slash).
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

app.use(express.json({ limit: "100kb" }));

// Slows down password guessing on the login and register addresses.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Health check: asks the database for the current time.
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");
    res.json({ status: "ok", databaseTime: result.rows[0].time });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api", attendanceRoutes);

// Any address we don't have a route for.
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Last safety net: broken JSON and anything unexpected.
// (Express recognises an error handler by its four parameters.)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

export default app;