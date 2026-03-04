import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

export default router;
