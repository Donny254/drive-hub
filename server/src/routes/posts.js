import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  title: row.title,
  excerpt: row.excerpt,
  content: row.content,
  imageUrl: row.image_url,
  status: row.status,
  publishedAt: row.published_at,
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
    const result = await query(`SELECT * FROM posts ${whereClause} ORDER BY created_at DESC`, params);
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM posts WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Post not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { title, excerpt, content, imageUrl, status = "draft", publishedAt } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const result = await query(
      `INSERT INTO posts (title, excerpt, content, image_url, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [title, excerpt ?? null, content ?? null, imageUrl ?? null, status, publishedAt ?? null]
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
    maybeSet("excerpt", req.body.excerpt ?? undefined);
    maybeSet("content", req.body.content ?? undefined);
    maybeSet("image_url", req.body.imageUrl ?? undefined);
    if (req.body.status) {
      if (!["draft", "published"].includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      maybeSet("status", req.body.status);
    }
    if (req.body.publishedAt !== undefined) maybeSet("published_at", req.body.publishedAt);

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id);
    const result = await query(
      `UPDATE posts SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Post not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("DELETE FROM posts WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Post not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
