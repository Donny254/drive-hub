import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  bookingId: row.booking_id,
  sellerId: row.seller_id,
  listingId: row.listing_id,
  listingTitle: row.listing_title || null,
  buyerName: row.buyer_name || null,
  amountCents: Number(row.amount_cents || 0),
  feeCents: Number(row.fee_cents || 0),
  payoutAmountCents: Number(row.payout_amount_cents || 0),
  payoutStatus: row.payout_status || "pending",
  payoutAt: row.payout_at,
  notes: row.notes || null,
  paymentMethod: row.payment_method || null,
  paymentStatus: row.payment_status || "unpaid",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sp.*,
              b.listing_id,
              l.title AS listing_title,
              u.name AS buyer_name,
              b.payment_method,
              b.payment_status,
              (sp.amount_cents - sp.fee_cents) AS payout_amount_cents
       FROM seller_payouts sp
       LEFT JOIN bookings b ON b.id = sp.booking_id
       LEFT JOIN listings l ON l.id = b.listing_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE sp.seller_id = $1
       ORDER BY sp.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows.map(toApi));
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const params = [];
    const where = [];
    if (status && status !== "all") {
      params.push(status);
      where.push(`sp.payout_status = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT sp.*,
              b.listing_id,
              l.title AS listing_title,
              u.name AS buyer_name,
              b.payment_method,
              b.payment_status,
              (sp.amount_cents - sp.fee_cents) AS payout_amount_cents
       FROM seller_payouts sp
       LEFT JOIN bookings b ON b.id = sp.booking_id
       LEFT JOIN listings l ON l.id = b.listing_id
       LEFT JOIN users u ON u.id = b.user_id
       ${whereClause}
       ORDER BY sp.created_at DESC`,
      params
    );
    return res.json(result.rows.map(toApi));
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { payoutStatus, notes } = req.body;
    const validStatuses = new Set(["pending", "paid", "failed", "cancelled"]);
    if (payoutStatus !== undefined && !validStatuses.has(payoutStatus)) {
      return res.status(400).json({ error: "Invalid payout status" });
    }

    const updates = [];
    const values = [];
    const maybeSet = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    };

    maybeSet("payout_status", payoutStatus);
    maybeSet("notes", notes);
    if (payoutStatus === "paid") {
      maybeSet("payout_at", new Date().toISOString());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE seller_payouts SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Payout not found" });
    }
    return res.json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

export default router;
