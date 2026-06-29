import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const allowedCategories = new Set(["Merchandise", "Accessories"]);

const toApi = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  category: row.category,
  imageUrl: row.image_url,
  imageUrls: row.image_urls ?? [],
  sizes: row.sizes ?? [],
  stock: row.stock,
  active: row.active,
  averageRating: row.average_rating ? Number(row.average_rating) : 0,
  reviewsCount: row.reviews_count ? Number(row.reviews_count) : 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toReviewApi = (row) => ({
  id: row.id,
  productId: row.product_id,
  userId: row.user_id,
  userName: row.user_name || "Customer",
  rating: Number(row.rating),
  comment: row.comment,
  createdAt: row.created_at,
});

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const parseImageUrls = (imageUrl, imageUrls) => {
  const urls = parseList(imageUrls).slice(0, 6);
  const primary = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : urls[0] ?? null;
  const merged = [primary, ...urls].filter(Boolean);
  return {
    primary,
    images: Array.from(new Set(merged)).slice(0, 6),
  };
};

const normalizeCategory = (category) => {
  if (category === null || category === undefined || category === "") return null;
  return allowedCategories.has(category) ? category : undefined;
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
    const result = await query(
      `SELECT p.*,
              COALESCE(ROUND(AVG(pr.rating)::numeric, 1), 0) AS average_rating,
              COUNT(pr.id) AS reviews_count
       FROM products p
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
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
      `SELECT p.*,
              COALESCE(ROUND(AVG(pr.rating)::numeric, 1), 0) AS average_rating,
              COUNT(pr.id) AS reviews_count
       FROM products p
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
    const reviews = await query(
      `SELECT pr.*, COALESCE(u.name, u.email) AS user_name
       FROM product_reviews pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.product_id = $1
       ORDER BY pr.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...toApi(result.rows[0]), reviews: reviews.rows.map(toReviewApi) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, description, priceCents, category, imageUrl, imageUrls, sizes, stock = 0, active = true } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!Number.isInteger(priceCents)) {
      return res.status(400).json({ error: "priceCents must be an integer" });
    }
    if (!Number.isInteger(stock)) {
      return res.status(400).json({ error: "stock must be an integer" });
    }
    const normalizedCategory = normalizeCategory(category);
    if (normalizedCategory === undefined) {
      return res.status(400).json({ error: "Category must be Merchandise or Accessories" });
    }
    const parsedImages = parseImageUrls(imageUrl, imageUrls);
    const result = await query(
      `INSERT INTO products (name, description, price_cents, category, image_url, image_urls, sizes, stock, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [name, description ?? null, priceCents, normalizedCategory, parsedImages.primary, parsedImages.images, parseList(sizes), stock, Boolean(active)]
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
    if (req.body.category !== undefined) {
      const normalizedCategory = normalizeCategory(req.body.category);
      if (normalizedCategory === undefined) {
        return res.status(400).json({ error: "Category must be Merchandise or Accessories" });
      }
      maybeSet("category", normalizedCategory);
    }
    if (req.body.imageUrl !== undefined || req.body.imageUrls !== undefined) {
      const parsedImages = parseImageUrls(req.body.imageUrl, req.body.imageUrls);
      maybeSet("image_url", parsedImages.primary);
      maybeSet("image_urls", parsedImages.images);
    }
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

router.post("/:id/reviews", requireAuth, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }
    const product = await query("SELECT id FROM products WHERE id = $1", [req.params.id]);
    if (product.rowCount === 0) return res.status(404).json({ error: "Product not found" });

    const result = await query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [req.params.id, req.user.id, rating, comment || null]
    );
    res.status(201).json(toReviewApi(result.rows[0]));
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
