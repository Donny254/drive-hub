import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";
import { sendCryptoPaymentStatusEmail } from "../email.js";

const router = Router();

const allowedStatuses = new Set(["pending", "paid", "cancelled", "refunded"]);

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  totalCents: row.total_cents,
  paymentMethod: row.payment_method || null,
  paymentStatus: row.payment_status || "unpaid",
  paidAt: row.paid_at,
  cryptoReviewNotes: row.crypto_review_notes || null,
  cryptoProofImageUrl: row.crypto_proof_image_url || null,
  status: row.status,
  createdAt: row.created_at,
  itemsCount: row.items_count ? Number(row.items_count) : 0,
});

const toItemApi = (row) => ({
  id: row.id,
  orderId: row.order_id,
  productId: row.product_id,
  name: row.name,
  priceCents: row.price_cents,
  quantity: row.quantity,
  size: row.size,
  imageUrl: row.image_url,
  createdAt: row.created_at,
});

const loadOrderOwner = async (req, res, next) => {
  try {
    const ownerResult = await query("SELECT user_id FROM orders WHERE id = $1", [req.params.id]);
    if (ownerResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    req.orderOwnerId = ownerResult.rows[0].user_id;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      const result = await query(
        `SELECT o.*, (
            SELECT COUNT(*) FROM order_items WHERE order_id = o.id
         ) AS items_count,
         (
            SELECT review_notes
            FROM crypto_transactions ct
            WHERE ct.order_id = o.id
            ORDER BY ct.created_at DESC
            LIMIT 1
         ) AS crypto_review_notes,
         (
            SELECT proof_image_url
            FROM crypto_transactions ct
            WHERE ct.order_id = o.id
            ORDER BY ct.created_at DESC
            LIMIT 1
         ) AS crypto_proof_image_url
         FROM orders o
         ORDER BY o.created_at DESC`
      );
      return res.json(result.rows.map(toApi));
    }

    const result = await query(
      `SELECT o.*, (
          SELECT COUNT(*) FROM order_items WHERE order_id = o.id
       ) AS items_count,
       (
          SELECT review_notes
          FROM crypto_transactions ct
          WHERE ct.order_id = o.id
          ORDER BY ct.created_at DESC
          LIMIT 1
       ) AS crypto_review_notes,
       (
          SELECT proof_image_url
          FROM crypto_transactions ct
          WHERE ct.order_id = o.id
          ORDER BY ct.created_at DESC
          LIMIT 1
       ) AS crypto_proof_image_url
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:id",
  requireAuth,
  loadOrderOwner,
  requireAdminOrOwner((req) => req.orderOwnerId),
  async (req, res, next) => {
    try {
      const orderResult = await query(
        `SELECT o.*,
                (
                  SELECT review_notes
                  FROM crypto_transactions ct
                  WHERE ct.order_id = o.id
                  ORDER BY ct.created_at DESC
                  LIMIT 1
                ) AS crypto_review_notes,
                (
                  SELECT proof_image_url
                  FROM crypto_transactions ct
                  WHERE ct.order_id = o.id
                  ORDER BY ct.created_at DESC
                  LIMIT 1
                ) AS crypto_proof_image_url
         FROM orders o
         WHERE o.id = $1`,
        [req.params.id]
      );
      if (orderResult.rowCount === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      const itemsResult = await query(
        "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC",
        [req.params.id]
      );

      return res.json({
        ...toApi(orderResult.rows[0]),
        items: itemsResult.rows.map(toItemApi),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { totalCents, status } = req.body;
    if (!Number.isInteger(totalCents)) {
      return res.status(400).json({ error: "totalCents must be an integer" });
    }

    const orderStatus = status && allowedStatuses.has(status) ? status : "pending";

    const result = await query(
      `INSERT INTO orders (user_id, total_cents, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, totalCents, orderStatus]
    );

    res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  requireAuth,
  loadOrderOwner,
  requireAdminOrOwner((req) => req.orderOwnerId),
  async (req, res, next) => {
    try {
      const { totalCents, status, paymentMethod, paymentStatus, cryptoReviewNotes, cryptoProofImageUrl } = req.body;
      const updates = [];
      const values = [];

      const maybeSet = (column, value) => {
        if (value !== undefined) {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        }
      };

      if (totalCents !== undefined) {
        if (!Number.isInteger(totalCents)) {
          return res.status(400).json({ error: "totalCents must be an integer" });
        }
        maybeSet("total_cents", totalCents);
      }

      if (status) {
        if (!allowedStatuses.has(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        if (req.user.role !== "admin" && status !== "cancelled") {
          return res.status(403).json({ error: "Only admins can change to this status" });
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
        `UPDATE orders SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Order not found" });
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
           WHERE order_id = $2
             AND id = (
               SELECT id FROM crypto_transactions
               WHERE order_id = $2
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
            referenceLabel: `order ${updated.id.slice(0, 8)}`,
            paymentStatus: updated.payment_status,
            reviewNotes: cryptoReviewNotes ?? null,
          });
        }
      }
      const reload = await query(
        `SELECT o.*,
                (
                  SELECT review_notes
                  FROM crypto_transactions ct
                  WHERE ct.order_id = o.id
                  ORDER BY ct.created_at DESC
                  LIMIT 1
                ) AS crypto_review_notes,
                (
                  SELECT proof_image_url
                  FROM crypto_transactions ct
                  WHERE ct.order_id = o.id
                  ORDER BY ct.created_at DESC
                  LIMIT 1
                ) AS crypto_proof_image_url
         FROM orders o
         WHERE o.id = $1`,
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
  loadOrderOwner,
  requireAdminOrOwner((req) => req.orderOwnerId),
  async (req, res, next) => {
    try {
      const result = await query("DELETE FROM orders WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
