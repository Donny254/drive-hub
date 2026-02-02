import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = Router();

const allowedStatuses = new Set(["pending", "paid", "cancelled", "refunded"]);

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  totalCents: row.total_cents,
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
         ) AS items_count
         FROM orders o
         ORDER BY o.created_at DESC`
      );
      return res.json(result.rows.map(toApi));
    }

    const result = await query(
      `SELECT o.*, (
          SELECT COUNT(*) FROM order_items WHERE order_id = o.id
       ) AS items_count
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
      const orderResult = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
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
      const { totalCents, status } = req.body;
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

      res.json(toApi(result.rows[0]));
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
