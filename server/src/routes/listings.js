import { Router } from "express";
import { query } from "../db.js";
import { optionalAuth, requireAuth, requireAdminOrOwner } from "../middleware/auth.js";
import { sendListingModerationEmail } from "../email.js";
import { sendListingModerationMessage } from "../notifications.js";

const router = Router();

const allowedTypes = new Set(["buy", "rent", "sell"]);
const allowedStatuses = new Set(["pending_approval", "active", "sold", "inactive", "rejected"]);

const createAuditLog = async ({ listingId, actorUserId = null, action, details = {} }) => {
  await query(
    `INSERT INTO listing_audit_logs (listing_id, actor_user_id, action, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [listingId, actorUserId, action, JSON.stringify(details)]
  );
};

const listChangedFields = (current, updated, fieldMap) =>
  fieldMap
    .filter(([fromKey, toKey]) => current[fromKey] !== updated[toKey])
    .map(([, toKey]) => toKey);

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
  moderationNotes: row.moderation_notes || null,
  riskFlags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
  riskScore: Number(row.risk_score || 0),
  approvedAt: row.approved_at || null,
  approvedBy: row.approved_by || null,
  images: row.images ?? undefined,
  seller: row.seller_id
    ? {
        id: row.seller_id,
        name: row.seller_name || "Seller",
        role: row.seller_role || "user",
        createdAt: row.seller_created_at || null,
        activeListingsCount: Number(row.seller_active_listings_count || 0),
        trustLevel:
          row.seller_verification_status === "verified"
            ? "verified"
            : Number(row.seller_active_listings_count || 0) >= 3 || row.seller_role === "admin"
              ? "dealer"
              : "private",
        verificationStatus: row.seller_verification_status || "unverified",
      }
    : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateListingQuality = ({ title, priceCents, year, imageUrl, description, location }) => {
  if (!title || typeof title !== "string" || !title.trim()) {
    return "Title is required";
  }
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    return "priceCents must be a positive integer";
  }
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    return "Year must be valid";
  }
  if (!location || String(location).trim().length < 2) {
    return "Location is required";
  }
  if (!description || !String(description).trim()) {
    return "Description is required";
  }
  if (!imageUrl || typeof imageUrl !== "string") {
    return "A primary image is required";
  }
  return null;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const detectRiskFlags = async ({
  userId,
  title,
  priceCents,
  year,
  imageUrl,
  description,
  location,
  excludeListingId = null,
}) => {
  const flags = new Set();
  let score = 0;

  const titleKey = normalizeText(title);
  const locationKey = normalizeText(location);
  const descriptionText = String(description || "").toLowerCase();

  const duplicateResult = await query(
    `SELECT id, title, price_cents, year, image_url, location, created_at
     FROM listings
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR id <> $2)
     ORDER BY created_at DESC
     LIMIT 25`,
    [userId, excludeListingId]
  );

  for (const row of duplicateResult.rows) {
    const sameTitle = normalizeText(row.title) === titleKey;
    const sameLocation = normalizeText(row.location) === locationKey;
    const samePrice = Number(row.price_cents) === Number(priceCents);
    const sameYear = Number(row.year) === Number(year);
    const sameImage =
      imageUrl && row.image_url && String(row.image_url).trim() === String(imageUrl).trim();

    if (sameTitle && samePrice && sameYear) {
      flags.add("duplicate_exact_vehicle");
    } else if (sameTitle && sameLocation) {
      flags.add("duplicate_title_location");
    }

    if (sameImage) {
      flags.add("duplicate_primary_image");
    }
  }

  if (/(?:\+?\d[\d\s-]{7,}\d)|(?:07\d{8})|(?:01\d{8})/.test(descriptionText)) {
    flags.add("contact_details_in_description");
  }
  if (/@|https?:\/\/|www\.|whatsapp/i.test(descriptionText)) {
    flags.add("off_platform_contact_attempt");
  }

  const velocityResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM listings
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '24 hours'
       AND ($2::uuid IS NULL OR id <> $2)`,
    [userId, excludeListingId]
  );

  if (Number(velocityResult.rows[0]?.count || 0) >= 5) {
    flags.add("high_submission_velocity");
  }

  if (flags.has("duplicate_exact_vehicle")) score += 50;
  if (flags.has("duplicate_primary_image")) score += 35;
  if (flags.has("duplicate_title_location")) score += 20;
  if (flags.has("contact_details_in_description")) score += 15;
  if (flags.has("off_platform_contact_attempt")) score += 20;
  if (flags.has("high_submission_velocity")) score += 15;

  return {
    riskFlags: Array.from(flags),
    riskScore: Math.min(score, 100),
  };
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

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    const isAdmin = req.user?.role === "admin";

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
      if (!isAdmin && req.query.status !== "active") {
        return res.status(403).json({ error: "Forbidden" });
      }
      params.push(req.query.status);
      where.push(`status = $${params.length}`);
    } else if (!isAdmin) {
      params.push("active");
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
      `SELECT l.*,
              u.id AS seller_id,
              u.name AS seller_name,
              u.role AS seller_role,
              u.created_at AS seller_created_at,
              u.seller_verification_status AS seller_verification_status,
              COALESCE((
                SELECT COUNT(*)
                FROM listings sl
                WHERE sl.user_id = l.user_id AND sl.status = 'active'
              ), 0) AS seller_active_listings_count
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       ${whereClause}
       ORDER BY ${sort}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
      `SELECT l.*,
              u.id AS seller_id,
              u.name AS seller_name,
              u.role AS seller_role,
              u.created_at AS seller_created_at,
              u.seller_verification_status AS seller_verification_status,
              COALESCE((
                SELECT COUNT(*)
                FROM listings sl
                WHERE sl.user_id = l.user_id AND sl.status = 'active'
              ), 0) AS seller_active_listings_count
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/me", requireAuth, async (req, res, next) => {
  try {
    const [summaryResult, topListingsResult] = await Promise.all([
      query(
        `SELECT
            COUNT(*)::int AS total_listings,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
            COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_listings,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_listings,
            COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_listings,
            COALESCE(AVG(risk_score), 0)::float AS average_risk_score,
            COALESCE((
              SELECT COUNT(*)
              FROM listing_views lv
              INNER JOIN listings lx ON lx.id = lv.listing_id
              WHERE lx.user_id = $1
            ), 0)::int AS total_views
         FROM listings
         WHERE user_id = $1`,
        [req.user.id]
      ),
      query(
        `SELECT
            l.id,
            l.title,
            l.status,
            l.price_cents,
            COUNT(DISTINCT lv.id)::int AS views_count,
            COUNT(DISTINCT i.id)::int AS inquiries_count,
            COUNT(DISTINCT b.id)::int AS bookings_count
         FROM listings l
         LEFT JOIN listing_views lv ON lv.listing_id = l.id
         LEFT JOIN inquiries i ON i.listing_id = l.id
         LEFT JOIN bookings b ON b.listing_id = l.id
         WHERE l.user_id = $1
         GROUP BY l.id
         ORDER BY COUNT(DISTINCT i.id) DESC, COUNT(DISTINCT lv.id) DESC, COUNT(DISTINCT b.id) DESC, l.created_at DESC
         LIMIT 5`,
        [req.user.id]
      ),
    ]);

    const summary = summaryResult.rows[0] || {};
    const totalInquiriesResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM inquiries i
       INNER JOIN listings l ON l.id = i.listing_id
       WHERE l.user_id = $1`,
      [req.user.id]
    );
    const totalBookingsResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM bookings b
       INNER JOIN listings l ON l.id = b.listing_id
       WHERE l.user_id = $1`,
      [req.user.id]
    );
    const confirmedBookingsResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM bookings b
       INNER JOIN listings l ON l.id = b.listing_id
       WHERE l.user_id = $1 AND b.status = 'confirmed'`,
      [req.user.id]
    );

    const totalInquiries = Number(totalInquiriesResult.rows[0]?.count || 0);
    const totalBookings = Number(totalBookingsResult.rows[0]?.count || 0);
    const confirmedBookings = Number(confirmedBookingsResult.rows[0]?.count || 0);

    res.json({
      summary: {
        totalListings: Number(summary.total_listings || 0),
        activeListings: Number(summary.active_listings || 0),
        pendingListings: Number(summary.pending_listings || 0),
        rejectedListings: Number(summary.rejected_listings || 0),
        soldListings: Number(summary.sold_listings || 0),
        totalViews: Number(summary.total_views || 0),
        totalInquiries,
        totalBookings,
        confirmedBookings,
        viewToInquiryRate:
          Number(summary.total_views || 0) > 0
            ? Number(((totalInquiries / Number(summary.total_views || 0)) * 100).toFixed(1))
            : 0,
        inquiryToBookingRate: totalInquiries > 0 ? Number(((totalBookings / totalInquiries) * 100).toFixed(1)) : 0,
        inquiryToConfirmedRate: totalInquiries > 0 ? Number(((confirmedBookings / totalInquiries) * 100).toFixed(1)) : 0,
        averageRiskScore: Number(Number(summary.average_risk_score || 0).toFixed(1)),
      },
      topListings: topListingsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        priceCents: Number(row.price_cents || 0),
        viewsCount: Number(row.views_count || 0),
        inquiriesCount: Number(row.inquiries_count || 0),
        bookingsCount: Number(row.bookings_count || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/admin", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [summaryResult, topRiskResult, topViewedResult] = await Promise.all([
      query(
        `SELECT
            COUNT(*)::int AS total_listings,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
            COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_listings,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_listings,
            COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_listings,
            COUNT(*) FILTER (WHERE risk_score >= 50)::int AS high_risk_listings,
            COALESCE(AVG(risk_score), 0)::float AS average_risk_score,
            COALESCE((SELECT COUNT(*) FROM listing_views), 0)::int AS total_views,
            COALESCE((SELECT COUNT(*) FROM inquiries), 0)::int AS total_inquiries,
            COALESCE((SELECT COUNT(*) FROM bookings), 0)::int AS total_bookings,
            COALESCE((SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'), 0)::int AS confirmed_bookings,
            COALESCE((SELECT COUNT(*) FROM users WHERE seller_verification_status = 'verified'), 0)::int AS verified_sellers
         FROM listings`
      ),
      query(
        `SELECT
            l.id,
            l.title,
            l.status,
            l.risk_score,
            l.moderation_notes,
            u.name AS seller_name
         FROM listings l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.risk_score DESC, l.updated_at DESC
         LIMIT 5`
      ),
      query(
        `SELECT
            l.id,
            l.title,
            l.status,
            COUNT(lv.id)::int AS views_count,
            COUNT(DISTINCT i.id)::int AS inquiries_count
         FROM listings l
         LEFT JOIN listing_views lv ON lv.listing_id = l.id
         LEFT JOIN inquiries i ON i.listing_id = l.id
         GROUP BY l.id
         ORDER BY COUNT(lv.id) DESC, COUNT(DISTINCT i.id) DESC, l.updated_at DESC
         LIMIT 5`
      ),
    ]);

    const summary = summaryResult.rows[0] || {};
    const totalViews = Number(summary.total_views || 0);
    const totalInquiries = Number(summary.total_inquiries || 0);
    const totalBookings = Number(summary.total_bookings || 0);
    const confirmedBookings = Number(summary.confirmed_bookings || 0);

    return res.json({
      summary: {
        totalListings: Number(summary.total_listings || 0),
        activeListings: Number(summary.active_listings || 0),
        pendingListings: Number(summary.pending_listings || 0),
        rejectedListings: Number(summary.rejected_listings || 0),
        soldListings: Number(summary.sold_listings || 0),
        highRiskListings: Number(summary.high_risk_listings || 0),
        averageRiskScore: Number(Number(summary.average_risk_score || 0).toFixed(1)),
        totalViews,
        totalInquiries,
        totalBookings,
        confirmedBookings,
        verifiedSellers: Number(summary.verified_sellers || 0),
        viewToInquiryRate: totalViews > 0 ? Number(((totalInquiries / totalViews) * 100).toFixed(1)) : 0,
        inquiryToBookingRate: totalInquiries > 0 ? Number(((totalBookings / totalInquiries) * 100).toFixed(1)) : 0,
        inquiryToConfirmedRate:
          totalInquiries > 0 ? Number(((confirmedBookings / totalInquiries) * 100).toFixed(1)) : 0,
      },
      topRiskListings: topRiskResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        riskScore: Number(row.risk_score || 0),
        moderationNotes: row.moderation_notes || null,
        sellerName: row.seller_name || "Seller",
      })),
      topViewedListings: topViewedResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        viewsCount: Number(row.views_count || 0),
        inquiriesCount: Number(row.inquiries_count || 0),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/view", optionalAuth, async (req, res, next) => {
  try {
    const viewerKey = String(req.body?.viewerKey || "").trim();
    if (viewerKey.length < 8 || viewerKey.length > 120) {
      return res.status(400).json({ error: "viewerKey is required" });
    }

    const listingResult = await query("SELECT id, status FROM listings WHERE id = $1", [req.params.id]);
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listingResult.rows[0].status !== "active") {
      return res.status(400).json({ error: "Listing is not publicly viewable" });
    }

    const existingResult = await query(
      `SELECT id
       FROM listing_views
       WHERE listing_id = $1
         AND viewer_key = $2
         AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [req.params.id, viewerKey]
    );

    if (existingResult.rowCount === 0) {
      await query(
        `INSERT INTO listing_views (listing_id, user_id, viewer_key)
         VALUES ($1, $2, $3)`,
        [req.params.id, req.user?.id || null, viewerKey]
      );
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/:id/audit",
  requireAuth,
  loadListingOwner,
  requireAdminOrOwner((req) => req.listingOwnerId),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT lal.id,
                lal.action,
                lal.details,
                lal.created_at,
                u.id AS actor_id,
                u.name AS actor_name,
                u.email AS actor_email,
                u.role AS actor_role
         FROM listing_audit_logs lal
         LEFT JOIN users u ON u.id = lal.actor_user_id
         WHERE lal.listing_id = $1
         ORDER BY lal.created_at DESC
         LIMIT 100`,
        [req.params.id]
      );
      res.json(
        result.rows.map((row) => ({
          id: row.id,
          action: row.action,
          details: row.details && typeof row.details === "object" ? row.details : {},
          createdAt: row.created_at,
          actor: row.actor_id
            ? {
                id: row.actor_id,
                name: row.actor_name || null,
                email: row.actor_email || null,
                role: row.actor_role || null,
              }
            : null,
        }))
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*,
        u.id AS seller_id,
        u.name AS seller_name,
        u.role AS seller_role,
        u.created_at AS seller_created_at,
        u.seller_verification_status AS seller_verification_status,
        COALESCE((
          SELECT COUNT(*)
          FROM listings sl
          WHERE sl.user_id = l.user_id AND sl.status = 'active'
        ), 0) AS seller_active_listings_count,
        COALESCE(
          json_agg(json_build_object('id', li.id, 'url', li.url) ORDER BY li.position)
          FILTER (WHERE li.id IS NOT NULL),
          '[]'
        ) AS images
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN listing_images li ON li.listing_id = l.id
       WHERE l.id = $1
       GROUP BY l.id, u.id`,
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
      imageUrls,
      moderationNotes,
    } = req.body;
    const qualityError = validateListingQuality({
      title,
      priceCents,
      year,
      imageUrl,
      description,
      location,
    });
    if (qualityError) {
      return res.status(400).json({ error: qualityError });
    }
    if (!allowedTypes.has(listingType)) {
      return res.status(400).json({ error: "Invalid listing type" });
    }
    if (status !== undefined && !allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ownerId = req.user.role === "admin" && userId ? userId : req.user.id;
    const nextStatus = req.user.role === "admin" ? status : "pending_approval";
    const risk = await detectRiskFlags({
      userId: ownerId,
      title,
      priceCents,
      year,
      imageUrl,
      description,
      location,
    });

    const result = await query(
      `INSERT INTO listings
      (user_id, title, price_cents, year, mileage, fuel, power_hp, image_url, listing_type, featured, status, description, location, moderation_notes, risk_flags, risk_score, approved_at, approved_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
        nextStatus,
        description ?? null,
        location ?? null,
        req.user.role === "admin" ? moderationNotes ?? null : null,
        JSON.stringify(risk.riskFlags),
        risk.riskScore,
        req.user.role === "admin" && nextStatus === "active" ? new Date().toISOString() : null,
        req.user.role === "admin" && nextStatus === "active" ? req.user.id : null,
      ]
    );

    const listing = result.rows[0];

    const extraImages = Array.isArray(imageUrls)
      ? imageUrls.filter((url) => typeof url === "string" && url && url !== imageUrl)
      : [];
    for (let index = 0; index < extraImages.length; index += 1) {
      await query(
        "INSERT INTO listing_images (listing_id, url, position) VALUES ($1, $2, $3)",
        [listing.id, extraImages[index], index + 1]
      );
    }

    await createAuditLog({
      listingId: listing.id,
      actorUserId: req.user.id,
      action: "listing_created",
      details: {
        status: listing.status,
        createdByRole: req.user.role,
        riskScore: Number(listing.risk_score || 0),
        riskFlags: Array.isArray(listing.risk_flags) ? listing.risk_flags : [],
        extraImagesAdded: extraImages.length,
      },
    });

    res.status(201).json(toApi(listing));
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

      const currentResult = await query("SELECT * FROM listings WHERE id = $1", [req.params.id]);
      if (currentResult.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }
      const current = currentResult.rows[0];

      const nextTitle = req.body.title ?? current.title;
      const nextPriceCents = req.body.priceCents ?? current.price_cents;
      const nextYear = req.body.year ?? current.year;
      const nextImageUrl = req.body.imageUrl ?? current.image_url;
      const nextDescription = req.body.description ?? current.description;
      const nextLocation = req.body.location ?? current.location;
      const qualityError = validateListingQuality({
        title: nextTitle,
        priceCents: nextPriceCents,
        year: nextYear,
        imageUrl: nextImageUrl,
        description: nextDescription,
        location: nextLocation,
      });
      if (qualityError) {
        return res.status(400).json({ error: qualityError });
      }
      const targetUserId = req.user.role === "admin" && req.body.userId ? req.body.userId : current.user_id;
      const risk = await detectRiskFlags({
        userId: targetUserId,
        title: nextTitle,
        priceCents: nextPriceCents,
        year: nextYear,
        imageUrl: nextImageUrl,
        description: nextDescription,
        location: nextLocation,
        excludeListingId: req.params.id,
      });

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
      maybeSet("risk_flags", JSON.stringify(risk.riskFlags));
      maybeSet("risk_score", risk.riskScore);
      if (req.user.role === "admin") {
        maybeSet("status", req.body.status ?? undefined);
        maybeSet("moderation_notes", req.body.moderationNotes ?? undefined);
        if (req.body.status === "active") {
          maybeSet("approved_at", new Date().toISOString());
          maybeSet("approved_by", req.user.id);
        }
        if (req.body.status === "rejected") {
          maybeSet("approved_at", null);
          maybeSet("approved_by", null);
        }
      } else if (
        req.body.title !== undefined ||
        req.body.priceCents !== undefined ||
        req.body.year !== undefined ||
        req.body.mileage !== undefined ||
        req.body.fuel !== undefined ||
        req.body.powerHp !== undefined ||
        req.body.imageUrl !== undefined ||
        req.body.listingType !== undefined ||
        req.body.description !== undefined ||
        req.body.location !== undefined
      ) {
        maybeSet("status", "pending_approval");
        maybeSet("moderation_notes", null);
        maybeSet("approved_at", null);
        maybeSet("approved_by", null);
      }
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
      const updated = result.rows[0];
      const changedFields = listChangedFields(current, updated, [
        ["user_id", "userId"],
        ["title", "title"],
        ["price_cents", "priceCents"],
        ["year", "year"],
        ["mileage", "mileage"],
        ["fuel", "fuel"],
        ["power_hp", "powerHp"],
        ["image_url", "imageUrl"],
        ["listing_type", "listingType"],
        ["featured", "featured"],
        ["status", "status"],
        ["description", "description"],
        ["location", "location"],
        ["moderation_notes", "moderationNotes"],
        ["risk_score", "riskScore"],
        ["approved_at", "approvedAt"],
        ["approved_by", "approvedBy"],
      ]);

      const isModerationUpdate =
        req.user.role === "admin" && (req.body.status !== undefined || req.body.moderationNotes !== undefined);
      const isSellerResubmission =
        req.user.role !== "admin" &&
        current.status !== "pending_approval" &&
        updated.status === "pending_approval";

      await createAuditLog({
        listingId: updated.id,
        actorUserId: req.user.id,
        action: isModerationUpdate
          ? "moderation_updated"
          : isSellerResubmission
            ? "seller_resubmitted"
            : "listing_updated",
        details: {
          changedFields,
          previousStatus: current.status,
          nextStatus: updated.status,
          moderationNotes: updated.moderation_notes || null,
          riskScore: Number(updated.risk_score || 0),
          riskFlags: Array.isArray(updated.risk_flags) ? updated.risk_flags : [],
        },
      });

      if (
        req.user.role === "admin" &&
        (req.body.status !== undefined || req.body.moderationNotes !== undefined)
      ) {
        try {
          const ownerResult = await query(
            "SELECT email, name, phone FROM users WHERE id = $1",
            [result.rows[0].user_id]
          );
          if (ownerResult.rowCount > 0) {
            await sendListingModerationEmail({
              to: ownerResult.rows[0].email,
              sellerName: ownerResult.rows[0].name,
              listingTitle: result.rows[0].title,
              status: result.rows[0].status,
              moderationNotes: result.rows[0].moderation_notes,
            });
            await sendListingModerationMessage({
              phone: ownerResult.rows[0].phone || null,
              listingTitle: result.rows[0].title,
              status: result.rows[0].status,
              moderationNotes: result.rows[0].moderation_notes,
            });
          }
        } catch (mailError) {
          console.warn("Listing moderation email failed:", mailError);
        }
      }

      res.json(toApi(updated));
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
      const existingResult = await query("SELECT id, title, status FROM listings WHERE id = $1", [
        req.params.id,
      ]);
      if (existingResult.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }

      await createAuditLog({
        listingId: existingResult.rows[0].id,
        actorUserId: req.user.id,
        action: "listing_deleted",
        details: {
          title: existingResult.rows[0].title,
          previousStatus: existingResult.rows[0].status,
        },
      });

      const result = await query("DELETE FROM listings WHERE id = $1", [req.params.id]);
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

      await createAuditLog({
        listingId: req.params.id,
        actorUserId: req.user.id,
        action: "image_added",
        details: {
          imageId: insertResult.rows[0].id,
          url: insertResult.rows[0].url,
          position: insertResult.rows[0].position,
        },
      });

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

      await createAuditLog({
        listingId: req.params.id,
        actorUserId: req.user.id,
        action: "image_deleted",
        details: {
          imageId: req.params.imageId,
          url: imageUrl,
        },
      });

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
      await createAuditLog({
        listingId: req.params.id,
        actorUserId: req.user.id,
        action: "images_reordered",
        details: {
          imageIds,
        },
      });
      await query("COMMIT");

      res.status(200).json({ ok: true });
    } catch (error) {
      await query("ROLLBACK");
      next(error);
    }
  }
);

export default router;
