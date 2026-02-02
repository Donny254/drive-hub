import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = Router();

const allowedStatuses = new Set(["pending", "confirmed", "cancelled", "rejected"]);

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
         FROM bookings b
         LEFT JOIN listings l ON l.id = b.listing_id
         ORDER BY b.created_at DESC`
      );
      return res.json(result.rows.map(toApi));
    }

    const result = await query(
      `SELECT b.*, l.title AS listing_title, l.image_url AS listing_image_url
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
      const { startDate, endDate, status } = req.body;
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
      res.json(toApi(updated));
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
