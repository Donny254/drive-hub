import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle || null,
  description: row.description || null,
  ctaLabel: row.cta_label || null,
  ctaLink: row.cta_link || null,
  imageUrl: row.image_url || null,
  displayOrder: Number(row.display_order || 0),
  active: Boolean(row.active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeLink = (value) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  return String(value).trim();
};

const validateAdvert = ({ title, displayOrder, ctaLink }, { partial = false } = {}) => {
  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) {
      return "Title is required";
    }
  }

  if (displayOrder !== undefined && !Number.isInteger(displayOrder)) {
    return "displayOrder must be an integer";
  }

  if (ctaLink !== undefined && ctaLink !== null) {
    const normalized = String(ctaLink).trim();
    if (!normalized.startsWith("/") && !/^https?:\/\//i.test(normalized)) {
      return "ctaLink must start with /, http://, or https://";
    }
  }

  return null;
};

router.get("/", async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const whereClause = includeInactive ? "" : "WHERE active = true";
    const result = await query(
      `SELECT *
       FROM adverts
       ${whereClause}
       ORDER BY display_order ASC, created_at ASC`
    );
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM adverts WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Advert not found" });
    }
    return res.json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const payload = {
      title: req.body.title,
      subtitle: req.body.subtitle ?? null,
      description: req.body.description ?? null,
      ctaLabel: req.body.ctaLabel ?? null,
      ctaLink: normalizeLink(req.body.ctaLink) ?? "/market",
      imageUrl: req.body.imageUrl ?? null,
      displayOrder: req.body.displayOrder ?? 0,
      active: req.body.active ?? true,
    };

    const validationError = validateAdvert(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await query(
      `INSERT INTO adverts (title, subtitle, description, cta_label, cta_link, image_url, display_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        String(payload.title).trim(),
        payload.subtitle,
        payload.description,
        payload.ctaLabel,
        payload.ctaLink,
        payload.imageUrl,
        payload.displayOrder,
        Boolean(payload.active),
      ]
    );

    return res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const validationError = validateAdvert(
      {
        title: req.body.title,
        displayOrder: req.body.displayOrder,
        ctaLink: normalizeLink(req.body.ctaLink),
      },
      { partial: true }
    );
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const updates = [];
    const values = [];
    const maybeSet = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    };

    if (req.body.title !== undefined) maybeSet("title", String(req.body.title).trim());
    maybeSet("subtitle", req.body.subtitle ?? undefined);
    maybeSet("description", req.body.description ?? undefined);
    maybeSet("cta_label", req.body.ctaLabel ?? undefined);
    maybeSet("cta_link", normalizeLink(req.body.ctaLink));
    maybeSet("image_url", req.body.imageUrl ?? undefined);
    maybeSet("display_order", req.body.displayOrder ?? undefined);
    if (typeof req.body.active === "boolean") maybeSet("active", req.body.active);

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE adverts
       SET ${updates.join(", ")}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Advert not found" });
    }

    return res.json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("DELETE FROM adverts WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Advert not found" });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
