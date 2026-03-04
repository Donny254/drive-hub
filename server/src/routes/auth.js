import { Router } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, 'user', $3)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), name ?? null, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already in use" });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await query(
      "SELECT id, email, name, role, password_hash, created_at FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);
    delete user.password_hash;
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
