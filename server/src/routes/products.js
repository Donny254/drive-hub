import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  category: row.category,
  imageUrl: row.image_url,
  sizes: row.sizes ?? [],
  stock: row.stock,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseList = (value) => {
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
    if (req.query.category) {
      params.push(req.query.category);
      where.push(`category = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(`SELECT * FROM products ${whereClause} ORDER BY created_at DESC`, params);
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, description, priceCents, category, imageUrl, sizes, stock = 0, active = true } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!Number.isInteger(priceCents)) {
      return res.status(400).json({ error: "priceCents must be an integer" });
    }
    if (!Number.isInteger(stock)) {
      return res.status(400).json({ error: "stock must be an integer" });
    }
    const result = await query(
      `INSERT INTO products (name, description, price_cents, category, image_url, sizes, stock, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [name, description ?? null, priceCents, category ?? null, imageUrl ?? null, parseList(sizes), stock, Boolean(active)]
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

    maybeSet("name", req.body.name ?? undefined);
    maybeSet("description", req.body.description ?? undefined);
    if (req.body.priceCents !== undefined) {
      if (!Number.isInteger(req.body.priceCents)) {
        return res.status(400).json({ error: "priceCents must be an integer" });
      }
      maybeSet("price_cents", req.body.priceCents);
    }
    maybeSet("category", req.body.category ?? undefined);
    maybeSet("image_url", req.body.imageUrl ?? undefined);
    if (req.body.sizes !== undefined) maybeSet("sizes", parseList(req.body.sizes));
    if (req.body.stock !== undefined) {
      if (!Number.isInteger(req.body.stock)) {
        return res.status(400).json({ error: "stock must be an integer" });
      }
      maybeSet("stock", req.body.stock);
    }
    if (typeof req.body.active === "boolean") maybeSet("active", req.body.active);

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const result = await query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("DELETE FROM products WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
