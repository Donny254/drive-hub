import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = Router();

const allowedTypes = new Set(["buy", "rent", "sell"]);
const allowedStatuses = new Set(["active", "sold", "inactive"]);

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  priceCents: row.price_cents,
  year: row.year,
  mileage: row.mileage,
  fuel: row.fuel,
  powerHp: row.power_hp,
  imageUrl: row.image_url,
  listingType: row.listing_type,
  featured: row.featured,
  status: row.status,
  description: row.description,
  location: row.location,
  images: row.images ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const loadListingOwner = async (req, res, next) => {
  try {
    const ownerResult = await query("SELECT user_id FROM listings WHERE id = $1", [req.params.id]);
    if (ownerResult.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    req.listingOwnerId = ownerResult.rows[0].user_id;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/", async (req, res, next) => {
  try {
    const where = [];
    const params = [];

    if (req.query.q) {
      params.push(`%${String(req.query.q).toLowerCase()}%`);
      where.push(`LOWER(title) LIKE $${params.length}`);
    }

    if (req.query.type) {
      if (!allowedTypes.has(req.query.type)) {
        return res.status(400).json({ error: "Invalid listing type" });
      }
      params.push(req.query.type);
      where.push(`listing_type = $${params.length}`);
    }

    if (req.query.year) {
      const year = parseOptionalInt(req.query.year);
      if (!year) {
        return res.status(400).json({ error: "Invalid year" });
      }
      params.push(year);
      where.push(`year = $${params.length}`);
    }

    if (req.query.minPrice) {
      const minPrice = parseOptionalInt(req.query.minPrice);
      if (minPrice === null) {
        return res.status(400).json({ error: "Invalid minPrice" });
      }
      params.push(minPrice);
      where.push(`price_cents >= $${params.length}`);
    }

    if (req.query.maxPrice) {
      const maxPrice = parseOptionalInt(req.query.maxPrice);
      if (maxPrice === null) {
        return res.status(400).json({ error: "Invalid maxPrice" });
      }
      params.push(maxPrice);
      where.push(`price_cents <= $${params.length}`);
    }

    if (req.query.status) {
      if (!allowedStatuses.has(req.query.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    }

    if (req.query.featured !== undefined) {
      const isFeatured = req.query.featured === "true";
      params.push(isFeatured);
      where.push(`featured = $${params.length}`);
    }

    const limit = Math.min(parseOptionalInt(req.query.limit) ?? 50, 100);
    const offset = Math.max(parseOptionalInt(req.query.offset) ?? 0, 0);

    params.push(limit, offset);

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sort = req.query.sort === "price_asc"
      ? "price_cents ASC"
      : req.query.sort === "price_desc"
        ? "price_cents DESC"
        : req.query.sort === "year_desc"
          ? "year DESC NULLS LAST"
          : "created_at DESC";

    const result = await query(
      `SELECT * FROM listings ${whereClause} ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*,
        COALESCE(
          json_agg(json_build_object('id', li.id, 'url', li.url) ORDER BY li.position)
          FILTER (WHERE li.id IS NOT NULL),
          '[]'
        ) AS images
       FROM listings l
       LEFT JOIN listing_images li ON li.listing_id = l.id
       WHERE l.id = $1
       GROUP BY l.id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      priceCents,
      year,
      mileage,
      fuel,
      powerHp,
      imageUrl,
      listingType,
      featured = false,
      status = "active",
      description,
      location,
      userId,
    } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!Number.isInteger(priceCents)) {
      return res.status(400).json({ error: "priceCents must be an integer" });
    }
    if (!allowedTypes.has(listingType)) {
      return res.status(400).json({ error: "Invalid listing type" });
    }
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ownerId = req.user.role === "admin" && userId ? userId : req.user.id;

    const result = await query(
      `INSERT INTO listings
      (user_id, title, price_cents, year, mileage, fuel, power_hp, image_url, listing_type, featured, status, description, location)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        ownerId,
        title,
        priceCents,
        year ?? null,
        mileage ?? null,
        fuel ?? null,
        powerHp ?? null,
        imageUrl ?? null,
        listingType,
        Boolean(featured),
        status,
        description ?? null,
        location ?? null,
      ]
    );

    res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const updates = [];
      const values = [];

      const maybeSet = (column, value) => {
        if (value !== undefined) {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        }
      };

      if (req.body.listingType && !allowedTypes.has(req.body.listingType)) {
        return res.status(400).json({ error: "Invalid listing type" });
      }
      if (req.body.status && !allowedStatuses.has(req.body.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      if (req.user.role === "admin" && req.body.userId) {
        maybeSet("user_id", req.body.userId);
      }
      maybeSet("title", req.body.title ?? undefined);
      maybeSet("price_cents", req.body.priceCents ?? undefined);
      maybeSet("year", req.body.year ?? undefined);
      maybeSet("mileage", req.body.mileage ?? undefined);
      maybeSet("fuel", req.body.fuel ?? undefined);
      maybeSet("power_hp", req.body.powerHp ?? undefined);
      maybeSet("image_url", req.body.imageUrl ?? undefined);
      maybeSet("listing_type", req.body.listingType ?? undefined);
      if (typeof req.body.featured === "boolean") {
        maybeSet("featured", req.body.featured);
      }
      maybeSet("status", req.body.status ?? undefined);
      maybeSet("description", req.body.description ?? undefined);
      maybeSet("location", req.body.location ?? undefined);

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE listings SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }

      res.json(toApi(result.rows[0]));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const result = await query("DELETE FROM listings WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/images",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Image url is required" });
      }

      const positionResult = await query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM listing_images WHERE listing_id = $1",
        [req.params.id]
      );
      const nextPos = positionResult.rows[0]?.next_pos ?? 1;

      const insertResult = await query(
        "INSERT INTO listing_images (listing_id, url, position) VALUES ($1, $2, $3) RETURNING id, url, position",
        [req.params.id, url, nextPos]
      );

      await query(
        "UPDATE listings SET image_url = COALESCE(image_url, $1) WHERE id = $2",
        [url, req.params.id]
      );

      res.status(201).json(insertResult.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id/images/:imageId",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const imageResult = await query(
        "SELECT id, url FROM listing_images WHERE id = $1 AND listing_id = $2",
        [req.params.imageId, req.params.id]
      );
      if (imageResult.rowCount === 0) {
        return res.status(404).json({ error: "Image not found" });
      }

      const imageUrl = imageResult.rows[0].url;
      await query("DELETE FROM listing_images WHERE id = $1", [req.params.imageId]);

      const listingResult = await query("SELECT image_url FROM listings WHERE id = $1", [
        req.params.id,
      ]);
      if (listingResult.rowCount > 0 && listingResult.rows[0].image_url === imageUrl) {
        const nextImage = await query(
          "SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY position ASC LIMIT 1",
          [req.params.id]
        );
        const nextUrl = nextImage.rowCount > 0 ? nextImage.rows[0].url : null;
        await query("UPDATE listings SET image_url = $1 WHERE id = $2", [
          nextUrl,
          req.params.id,
        ]);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:id/images/reorder",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const { imageIds } = req.body;
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ error: "imageIds must be a non-empty array" });
      }

      const result = await query(
        "SELECT id FROM listing_images WHERE listing_id = $1",
        [req.params.id]
      );
      const existingIds = new Set(result.rows.map((row) => row.id));
      for (const id of imageIds) {
        if (!existingIds.has(id)) {
          return res.status(400).json({ error: "Invalid image id in list" });
        }
      }

      await query("BEGIN");
      for (let i = 0; i < imageIds.length; i += 1) {
        await query(
          "UPDATE listing_images SET position = $1 WHERE id = $2 AND listing_id = $3",
          [i + 1, imageIds[i], req.params.id]
        );
      }
      await query("COMMIT");

      res.status(200).json({ ok: true });
    } catch (error) {
      await query("ROLLBACK");
      next(error);
    }
  }
);

export default router;
