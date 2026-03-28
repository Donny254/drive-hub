import { Router } from "express";
import { query } from "../db.js";
import { getMailHealth } from "../email.js";

const router = Router();

router.get("/", async (req, res) => {
  const mailHealth = getMailHealth();
  try {
    await query("SELECT 1");
    res.json({
      ok: true,
      db: "ok",
      mail: mailHealth.configured ? "configured" : "not_configured",
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      db: "down",
      mail: mailHealth.configured ? "configured" : "not_configured",
      time: new Date().toISOString(),
    });
  }
});

export default router;
