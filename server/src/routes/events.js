import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  location: row.location,
  startDate: row.start_date,
  endDate: row.end_date,
  imageUrl: row.image_url,
  priceCents: Number(row.price_cents || 0),
  status: row.status,
  registrationsCount: row.registrations_count ? Number(row.registrations_count) : 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get("/", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT e.*, (
         SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id
       ) AS registrations_count
       FROM events e
       ${whereClause}
       ORDER BY e.start_date DESC NULLS LAST`,
      params
    );
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT e.*, (
         SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id
       ) AS registrations_count
       FROM events e
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Event not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const {
      title,
      description,
      location,
      startDate,
      endDate,
      imageUrl,
      priceCents = 0,
      status = "upcoming",
    } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return res.status(400).json({ error: "priceCents must be a non-negative integer" });
    }
    if (!["upcoming", "past", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const result = await query(
      `INSERT INTO events (title, description, location, start_date, end_date, image_url, price_cents, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        title,
        description ?? null,
        location ?? null,
        startDate ?? null,
        endDate ?? null,
        imageUrl ?? null,
        priceCents,
        status,
      ]
    );
    res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    const maybeSet = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    };

    maybeSet("title", req.body.title ?? undefined);
    maybeSet("description", req.body.description ?? undefined);
    maybeSet("location", req.body.location ?? undefined);
    maybeSet("start_date", req.body.startDate ?? undefined);
    maybeSet("end_date", req.body.endDate ?? undefined);
    maybeSet("image_url", req.body.imageUrl ?? undefined);
    if (req.body.priceCents !== undefined) {
      if (!Number.isInteger(req.body.priceCents) || req.body.priceCents < 0) {
        return res.status(400).json({ error: "priceCents must be a non-negative integer" });
      }
      maybeSet("price_cents", req.body.priceCents);
    }
    if (req.body.status) {
      if (!["upcoming", "past", "cancelled"].includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      maybeSet("status", req.body.status);
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const result = await query(
      `UPDATE events SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Event not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("DELETE FROM events WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Event not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
