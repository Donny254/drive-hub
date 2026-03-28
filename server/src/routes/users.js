import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizePhone } from "../notifications.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  phone: row.phone || null,
  role: row.role,
  sellerVerificationStatus: row.seller_verification_status || "unverified",
  sellerVerifiedAt: row.seller_verified_at || null,
  createdAt: row.created_at,
});

router.get("/public/:id", async (req, res, next) => {
  try {
    const userResult = await query(
      `SELECT u.id,
              u.name,
              u.phone,
              u.role,
              u.seller_verification_status,
              u.seller_verified_at,
              u.created_at,
              COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'active'), 0) AS active_listings_count,
              COALESCE(COUNT(l.id), 0) AS total_listings_count,
              COALESCE(COUNT(l.id) FILTER (WHERE l.featured = true AND l.status = 'active'), 0) AS featured_listings_count
       FROM users u
       LEFT JOIN listings l ON l.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.params.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = userResult.rows[0];
    if (Number(seller.active_listings_count || 0) === 0) {
      return res.status(404).json({ error: "Seller storefront not available" });
    }

    const listingsResult = await query(
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
       WHERE l.user_id = $1 AND l.status = 'active'
       ORDER BY l.featured DESC, l.created_at DESC`,
      [req.params.id]
    );

    res.json({
      seller: {
        id: seller.id,
        name: seller.name || "Seller",
        phone: seller.phone || null,
        role: seller.role || "user",
        sellerVerificationStatus: seller.seller_verification_status || "unverified",
        sellerVerifiedAt: seller.seller_verified_at || null,
        createdAt: seller.created_at,
        activeListingsCount: Number(seller.active_listings_count || 0),
        totalListingsCount: Number(seller.total_listings_count || 0),
        featuredListingsCount: Number(seller.featured_listings_count || 0),
      },
      listings: listingsResult.rows.map((row) => ({
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        seller: {
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
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, email, name, phone, role, seller_verification_status, seller_verified_at, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, phone, role, sellerVerificationStatus } = req.body;
    const updates = [];
    const values = [];

    const maybeSet = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    };

    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (phone !== undefined) {
      const normalizedPhone = phone ? normalizePhone(phone) : null;
      if (phone && !normalizedPhone) {
        return res.status(400).json({ error: "Phone number must be a valid Kenyan mobile number" });
      }
      maybeSet("phone", normalizedPhone);
    }
    if (
      sellerVerificationStatus &&
      !["unverified", "pending", "verified"].includes(sellerVerificationStatus)
    ) {
      return res.status(400).json({ error: "Invalid sellerVerificationStatus" });
    }

    const currentUserResult = await query(
      "SELECT id, role FROM users WHERE id = $1",
      [req.params.id]
    );
    if (currentUserResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const currentUser = currentUserResult.rows[0];

    maybeSet("name", name ?? undefined);
    if (role) {
      maybeSet("role", role);
      if (role !== currentUser.role) {
        updates.push("auth_token_version = auth_token_version + 1");
      }
    }
    if (sellerVerificationStatus) {
      maybeSet("seller_verification_status", sellerVerificationStatus);
      maybeSet("seller_verified_at", sellerVerificationStatus === "verified" ? new Date().toISOString() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, email, name, phone, role, seller_verification_status, seller_verified_at, created_at`,
      values
    );

    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await query("DELETE FROM users WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
