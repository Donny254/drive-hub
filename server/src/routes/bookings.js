import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";
import { sendCryptoPaymentStatusEmail } from "../email.js";

const router = Router();

const allowedStatuses = new Set(["pending", "confirmed", "cancelled", "rejected"]);

const loadSellerCommissionRate = async () => {
  const result = await query("SELECT seller_commission_rate FROM site_settings WHERE id = true");
  if (result.rowCount === 0) return 0;
  const rate = Number(result.rows[0].seller_commission_rate || 0);
  return Number.isFinite(rate) ? rate : 0;
};

const syncSellerPayout = async (booking) => {
  if (!booking.listing_id) return;
  const listingResult = await query("SELECT user_id FROM listings WHERE id = $1", [booking.listing_id]);
  if (listingResult.rowCount === 0 || !listingResult.rows[0].user_id) return;

  const sellerId = listingResult.rows[0].user_id;
  const commissionRate = await loadSellerCommissionRate();
  const feeCents = Math.max(0, Math.round(Number(booking.amount_cents || 0) * (commissionRate / 100)));
  const payoutStatus =
    booking.status === "confirmed" && booking.payment_status === "paid"
      ? "pending"
      : booking.status === "cancelled" || booking.status === "rejected"
        ? "cancelled"
        : "pending";

  await query(
    `INSERT INTO seller_payouts (booking_id, seller_id, amount_cents, fee_cents, payout_status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (booking_id) DO UPDATE
     SET seller_id = EXCLUDED.seller_id,
         amount_cents = EXCLUDED.amount_cents,
         fee_cents = EXCLUDED.fee_cents,
         payout_status = EXCLUDED.payout_status,
         updated_at = now()`,
    [booking.id, sellerId, Number(booking.amount_cents || 0), feeCents, payoutStatus]
  );
};

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  listingId: row.listing_id,
  listingTitle: row.listing_title || null,
  listingImageUrl: row.listing_image_url || null,
  startDate: row.start_date,
  endDate: row.end_date,
  amountCents: row.amount_cents,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  paidAt: row.paid_at,
  cryptoReviewNotes: row.crypto_review_notes || null,
  cryptoProofImageUrl: row.crypto_proof_image_url || null,
  status: row.status,
  createdAt: row.created_at,
});

const loadBookingOwner = async (req, res, next) => {
  try {
    const ownerResult = await query("SELECT user_id FROM bookings WHERE id = $1", [req.params.id]);
    if (ownerResult.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    req.bookingOwnerId = ownerResult.rows[0].user_id;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      const result = await query(
        `SELECT b.*, l.title AS listing_title, l.image_url AS listing_image_url
         ,(
          SELECT review_notes
          FROM crypto_transactions ct
          WHERE ct.booking_id = b.id
          ORDER BY ct.created_at DESC
          LIMIT 1
        ) AS crypto_review_notes,
        (
          SELECT proof_image_url
          FROM crypto_transactions ct
          WHERE ct.booking_id = b.id
          ORDER BY ct.created_at DESC
          LIMIT 1
        ) AS crypto_proof_image_url
         FROM bookings b
         LEFT JOIN listings l ON l.id = b.listing_id
         ORDER BY b.created_at DESC`
      );
      return res.json(result.rows.map(toApi));
    }

    const result = await query(
      `SELECT b.*, l.title AS listing_title, l.image_url AS listing_image_url
        ,(
          SELECT review_notes
          FROM crypto_transactions ct
          WHERE ct.booking_id = b.id
          ORDER BY ct.created_at DESC
          LIMIT 1
        ) AS crypto_review_notes,
        (
          SELECT proof_image_url
          FROM crypto_transactions ct
          WHERE ct.booking_id = b.id
          ORDER BY ct.created_at DESC
          LIMIT 1
        ) AS crypto_proof_image_url
       FROM bookings b
       LEFT JOIN listings l ON l.id = b.listing_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get("/availability", async (req, res, next) => {
  try {
    const { listingId } = req.query;
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }
    const result = await query(
      `SELECT start_date, end_date
       FROM bookings
       WHERE listing_id = $1
         AND status = 'confirmed'
       ORDER BY start_date ASC`,
      [listingId]
    );
    res.json(
      result.rows.map((row) => ({
        startDate: row.start_date,
        endDate: row.end_date,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { listingId, startDate, endDate } = req.body;
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const result = await query(
      `INSERT INTO bookings (user_id, listing_id, start_date, end_date, status, payment_status)
       VALUES ($1, $2, $3, $4, 'pending', 'unpaid')
       RETURNING *`,
      [req.user.id, listingId, startDate ?? null, endDate ?? null]
    );

    res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  requireAuth,
  loadBookingOwner,
  requireAdminOrOwner((req) => req.bookingOwnerId),
  async (req, res, next) => {
    try {
      const { startDate, endDate, status, paymentMethod, paymentStatus, cryptoReviewNotes, cryptoProofImageUrl } = req.body;
      const updates = [];
      const values = [];

      const maybeSet = (column, value) => {
        if (value !== undefined) {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        }
      };

      maybeSet("start_date", startDate ?? undefined);
      maybeSet("end_date", endDate ?? undefined);
      if (status) {
        if (!allowedStatuses.has(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        if (req.user.role !== "admin" && status === "rejected") {
          return res.status(403).json({ error: "Only admins can reject bookings" });
        }
        if (status === "confirmed") {
          const paymentResult = await query(
            "SELECT payment_status FROM bookings WHERE id = $1",
            [req.params.id]
          );
          if (paymentResult.rowCount > 0 && paymentResult.rows[0].payment_status !== "paid") {
            return res.status(400).json({ error: "Booking must be paid before confirmation" });
          }
        }
        maybeSet("status", status);
      }

      if (paymentMethod !== undefined) {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Only admins can update payment method" });
        }
        maybeSet("payment_method", paymentMethod || null);
      }

      if (paymentStatus !== undefined) {
        if (req.user.role !== "admin") {
          return res.status(403).json({ error: "Only admins can update payment status" });
        }
        if (!["unpaid", "pending", "paid", "failed"].includes(paymentStatus)) {
          return res.status(400).json({ error: "Invalid payment status" });
        }
        maybeSet("payment_status", paymentStatus);
        maybeSet("paid_at", paymentStatus === "paid" ? new Date().toISOString() : null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      values.push(req.params.id);

      const result = await query(
        `UPDATE bookings SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const updated = result.rows[0];
      if (
        (paymentStatus !== undefined ||
          paymentMethod !== undefined ||
          cryptoReviewNotes !== undefined ||
          cryptoProofImageUrl !== undefined) &&
        updated.payment_method === "crypto"
      ) {
        await query(
          `UPDATE crypto_transactions
           SET status = $1,
               review_notes = COALESCE($3, review_notes),
               proof_image_url = COALESCE($4, proof_image_url)
           WHERE booking_id = $2
             AND id = (
               SELECT id FROM crypto_transactions
               WHERE booking_id = $2
               ORDER BY created_at DESC
               LIMIT 1
             )`,
          [
            updated.payment_status === "paid" ? "paid" : updated.payment_status === "failed" ? "failed" : "pending",
            updated.id,
            cryptoReviewNotes ?? null,
            cryptoProofImageUrl ?? null,
          ]
        );
      }
      if (
        updated.payment_method === "crypto" &&
        paymentStatus !== undefined &&
        ["paid", "failed"].includes(updated.payment_status)
      ) {
        const userResult = await query("SELECT email, name FROM users WHERE id = $1", [updated.user_id]);
        if (userResult.rowCount > 0) {
          await sendCryptoPaymentStatusEmail({
            to: userResult.rows[0].email,
            customerName: userResult.rows[0].name,
            referenceLabel: `booking ${updated.id.slice(0, 8)}`,
            paymentStatus: updated.payment_status,
            reviewNotes: cryptoReviewNotes ?? null,
          });
        }
      }
      if (status === "confirmed") {
        const listingResult = await query("SELECT listing_type FROM listings WHERE id = $1", [
          updated.listing_id,
        ]);
        if (listingResult.rowCount > 0) {
          const listingType = listingResult.rows[0].listing_type;
          const nextStatus = listingType === "rent" ? "inactive" : "sold";
          await query("UPDATE listings SET status = $1 WHERE id = $2", [nextStatus, updated.listing_id]);
        }
      }
      if (updated.listing_id) {
        await syncSellerPayout(updated);
      }
      const reload = await query(
        `SELECT b.*, l.title AS listing_title, l.image_url AS listing_image_url
         ,(
            SELECT review_notes
            FROM crypto_transactions ct
            WHERE ct.booking_id = b.id
            ORDER BY ct.created_at DESC
            LIMIT 1
          ) AS crypto_review_notes,
          (
            SELECT proof_image_url
            FROM crypto_transactions ct
            WHERE ct.booking_id = b.id
            ORDER BY ct.created_at DESC
            LIMIT 1
          ) AS crypto_proof_image_url
         FROM bookings b
         LEFT JOIN listings l ON l.id = b.listing_id
         WHERE b.id = $1`,
        [updated.id]
      );
      res.json(toApi(reload.rows[0]));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  loadBookingOwner,
  requireAdminOrOwner((req) => req.bookingOwnerId),
  async (req, res, next) => {
    try {
      const result = await query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
