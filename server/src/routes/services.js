import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  features: row.features ?? [],
  priceCents: row.price_cents,
  imageUrl: row.image_url,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseFeatures = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

router.get("/", async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.active !== undefined) {
      const isActive = req.query.active === "true";
      params.push(isActive);
      where.push(`active = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(`SELECT * FROM services ${whereClause} ORDER BY created_at DESC`, params);
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM services WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Service not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { title, description, features, priceCents, imageUrl, active = true } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (priceCents !== null && priceCents !== undefined && !Number.isInteger(priceCents)) {
      return res.status(400).json({ error: "priceCents must be an integer" });
    }
    const parsedFeatures = parseFeatures(features);

    const result = await query(
      `INSERT INTO services (title, description, features, price_cents, image_url, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [title, description ?? null, parsedFeatures, priceCents ?? null, imageUrl ?? null, Boolean(active)]
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

    if (req.body.features !== undefined) {
      maybeSet("features", parseFeatures(req.body.features));
    }
    maybeSet("title", req.body.title ?? undefined);
    maybeSet("description", req.body.description ?? undefined);
    if (req.body.priceCents !== undefined) {
      if (!Number.isInteger(req.body.priceCents)) {
        return res.status(400).json({ error: "priceCents must be an integer" });
      }
      maybeSet("price_cents", req.body.priceCents);
    }
    maybeSet("image_url", req.body.imageUrl ?? undefined);
    if (typeof req.body.active === "boolean") {
      maybeSet("active", req.body.active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    values.push(req.params.id);

    const result = await query(
      `UPDATE services SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Service not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("DELETE FROM services WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Service not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
