import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  serviceId: row.service_id,
  serviceTitle: row.service_title || null,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  scheduledDate: row.scheduled_date,
  notes: row.notes,
  status: row.status,
  createdAt: row.created_at,
});

const loadOwner = async (req, res, next) => {
  try {
    const ownerResult = await query("SELECT user_id FROM service_bookings WHERE id = $1", [
      req.params.id,
    ]);
    if (ownerResult.rowCount === 0) {
      return res.status(404).json({ error: "Service booking not found" });
    }
    req.bookingOwnerId = ownerResult.rows[0].user_id;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const q = req.query.q ? `%${String(req.query.q).toLowerCase()}%` : null;
    const statusFilter = req.query.status && req.query.status !== "all" ? req.query.status : null;

    if (req.user.role === "admin") {
      const where = [];
      const params = [];
      if (statusFilter) { params.push(statusFilter); where.push(`sb.status = $${params.length}`); }
      if (q) { params.push(q); where.push(`(LOWER(s.title) LIKE $${params.length} OR LOWER(sb.contact_name) LIKE $${params.length})`); }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      params.push(limit, offset);

      const [dataResult, countResult] = await Promise.all([
        query(
          `SELECT sb.*, s.title AS service_title FROM service_bookings sb LEFT JOIN services s ON s.id = sb.service_id
           ${whereClause} ORDER BY sb.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params
        ),
        query(`SELECT COUNT(*)::int AS total FROM service_bookings sb LEFT JOIN services s ON s.id = sb.service_id ${whereClause}`, params.slice(0, -2)),
      ]);
      return res.json({ data: dataResult.rows.map(toApi), total: countResult.rows[0].total, limit, offset });
    }

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT sb.*, s.title AS service_title FROM service_bookings sb LEFT JOIN services s ON s.id = sb.service_id
         WHERE sb.user_id = $1 ORDER BY sb.created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
      query("SELECT COUNT(*)::int AS total FROM service_bookings WHERE user_id = $1", [req.user.id]),
    ]);
    return res.json({ data: dataResult.rows.map(toApi), total: countResult.rows[0].total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { serviceId, contactName, contactPhone, scheduledDate, notes } = req.body;
    if (!serviceId) {
      return res.status(400).json({ error: "serviceId is required" });
    }
    const insertResult = await query(
      `INSERT INTO service_bookings
       (user_id, service_id, contact_name, contact_phone, scheduled_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        serviceId,
        contactName || null,
        contactPhone || null,
        scheduledDate || null,
        notes || null,
      ]
    );

    res.status(201).json(toApi(insertResult.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  requireAuth,
  loadOwner,
  requireAdminOrOwner((req) => req.bookingOwnerId),
  async (req, res, next) => {
    try {
      const { contactName, contactPhone, scheduledDate, notes, status } = req.body;
      const updates = [];
      const values = [];

      const maybeSet = (column, value) => {
        if (value !== undefined) {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        }
      };

      maybeSet("contact_name", contactName);
      maybeSet("contact_phone", contactPhone);
      maybeSet("scheduled_date", scheduledDate);
      maybeSet("notes", notes);

      if (status !== undefined) {
        if (!["pending", "confirmed", "cancelled"].includes(status)) {
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
        `UPDATE service_bookings SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values
      );
      res.json(toApi(result.rows[0]));
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  loadOwner,
  requireAdminOrOwner((req) => req.bookingOwnerId),
  async (req, res, next) => {
    try {
      const result = await query("DELETE FROM service_bookings WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Service booking not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
