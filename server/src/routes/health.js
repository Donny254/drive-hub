import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "ok", time: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, db: "down", time: new Date().toISOString() });
  }
});

export default router;
