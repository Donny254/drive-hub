import { Router } from "express";
import { query } from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { sendListingBidEmail } from "../email.js";
import { sendListingBidMessage } from "../notifications.js";

const router = Router();

const allowedStatuses = new Set(["pending", "accepted", "rejected"]);

const toApi = (row) => ({
  id: row.id,
  listingId: row.listing_id,
  listingTitle: row.listing_title || null,
  listingPriceCents: row.listing_price_cents == null ? null : Number(row.listing_price_cents),
  listingImageUrl: row.listing_image_url || null,
  sellerId: row.seller_id || null,
  sellerName: row.seller_name || null,
  userId: row.user_id || null,
  bidderName: row.bidder_name,
  bidderEmail: row.bidder_email || null,
  bidderPhone: row.bidder_phone || null,
  amountCents: Number(row.amount_cents || 0),
  message: row.message || null,
  status: row.status,
  handledAt: row.handled_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseAmountCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role !== "admin") {
      params.push(req.user.id);
      where.push(`l.user_id = $${params.length}`);
    }

    if (req.query.status) {
      if (!allowedStatuses.has(req.query.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      params.push(req.query.status);
      where.push(`lb.status = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT lb.*,
              l.title AS listing_title,
              l.price_cents AS listing_price_cents,
              l.image_url AS listing_image_url,
              u.id AS seller_id,
              u.name AS seller_name
       FROM listing_bids lb
       INNER JOIN listings l ON l.id = lb.listing_id
       LEFT JOIN users u ON u.id = l.user_id
       ${whereClause}
       ORDER BY lb.created_at DESC
       LIMIT 200`,
      params
    );

    return res.json(result.rows.map(toApi));
  } catch (error) {
    return next(error);
  }
});

router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const { listingId, amountCents, bidderName, bidderEmail, bidderPhone, message } = req.body;
    const parsedAmount = parseAmountCents(amountCents);

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: "Bid amount must be greater than zero" });
    }
    if (!bidderName || !String(bidderName).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!bidderEmail && !bidderPhone) {
      return res.status(400).json({ error: "Email or phone is required" });
    }

    const listingResult = await query(
      `SELECT l.id,
              l.title,
              l.price_cents,
              l.status,
              l.user_id,
              u.name AS seller_name,
              u.email AS seller_email,
              u.phone AS seller_phone
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [listingId]
    );
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];
    if (listing.status !== "active") {
      return res.status(400).json({ error: "Bids can only be placed on active listings" });
    }
    if (req.user?.id && listing.user_id === req.user.id) {
      return res.status(400).json({ error: "You cannot bid on your own listing" });
    }

    const result = await query(
      `INSERT INTO listing_bids
       (listing_id, user_id, bidder_name, bidder_email, bidder_phone, amount_cents, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        listingId,
        req.user?.id || null,
        String(bidderName).trim(),
        bidderEmail ? String(bidderEmail).trim() : null,
        bidderPhone ? String(bidderPhone).trim() : null,
        parsedAmount,
        message ? String(message).trim() : null,
      ]
    );

    const bid = result.rows[0];
    try {
      await sendListingBidEmail({
        to: listing.seller_email || null,
        sellerName: listing.seller_name || "Seller",
        listingTitle: listing.title,
        askingPriceCents: listing.price_cents,
        bid,
      });
      await sendListingBidMessage({
        phone: listing.seller_phone || null,
        listingTitle: listing.title,
        amountCents: parsedAmount,
        bidderName,
        bidderPhone,
      });
    } catch (error) {
      console.warn("Bid notification failed:", error);
    }

    return res.status(201).json(toApi({ ...bid, listing_title: listing.title, listing_price_cents: listing.price_cents }));
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const bidResult = await query(
      `SELECT lb.id, l.user_id AS seller_id
       FROM listing_bids lb
       INNER JOIN listings l ON l.id = lb.listing_id
       WHERE lb.id = $1`,
      [req.params.id]
    );
    if (bidResult.rowCount === 0) {
      return res.status(404).json({ error: "Bid not found" });
    }
    if (req.user.role !== "admin" && bidResult.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const handledAt = status === "pending" ? null : new Date().toISOString();
    const result = await query(
      `UPDATE listing_bids
       SET status = $1, handled_at = $2
       WHERE id = $3
       RETURNING *`,
      [status, handledAt, req.params.id]
    );

    return res.json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

export default router;
