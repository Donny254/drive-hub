import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  eventId: row.event_id,
  eventTitle: row.event_title || null,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  tickets: row.tickets,
  notes: row.notes,
  status: row.status,
  createdAt: row.created_at,
});

const loadOwner = async (req, res, next) => {
  try {
    const ownerResult = await query("SELECT user_id FROM event_registrations WHERE id = $1", [
      req.params.id,
    ]);
    if (ownerResult.rowCount === 0) {
      return res.status(404).json({ error: "Event registration not found" });
    }
    req.registrationOwnerId = ownerResult.rows[0].user_id;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const eventId = req.query.eventId || null;
    if (req.user.role === "admin") {
      const params = [];
      const where = [];
      if (eventId) {
        params.push(eventId);
        where.push(`er.event_id = $${params.length}`);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await query(
        `SELECT er.*, e.title AS event_title
         FROM event_registrations er
         LEFT JOIN events e ON e.id = er.event_id
         ${whereClause}
         ORDER BY er.created_at DESC`,
        params
      );
      return res.json(result.rows.map(toApi));
    }

    const params = [req.user.id];
    const where = [`er.user_id = $1`];
    if (eventId) {
      params.push(eventId);
      where.push(`er.event_id = $${params.length}`);
    }
    const result = await query(
      `SELECT er.*, e.title AS event_title
       FROM event_registrations er
       LEFT JOIN events e ON e.id = er.event_id
       WHERE ${where.join(" AND ")}
       ORDER BY er.created_at DESC`,
      params
    );
    return res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { eventId, contactName, contactPhone, tickets, notes } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: "eventId is required" });
    }
    if (tickets !== undefined && (!Number.isInteger(tickets) || tickets <= 0)) {
      return res.status(400).json({ error: "tickets must be a positive integer" });
    }

    const insertResult = await query(
      `INSERT INTO event_registrations
       (user_id, event_id, contact_name, contact_phone, tickets, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        eventId,
        contactName || null,
        contactPhone || null,
        Number.isInteger(tickets) ? tickets : 1,
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
  requireAdminOrOwner((req) => req.registrationOwnerId),
  async (req, res, next) => {
    try {
      const { contactName, contactPhone, tickets, notes, status } = req.body;
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
      if (tickets !== undefined) {
        if (!Number.isInteger(tickets) || tickets <= 0) {
          return res.status(400).json({ error: "tickets must be a positive integer" });
        }
        maybeSet("tickets", tickets);
      }
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
        `UPDATE event_registrations SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
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
  requireAdminOrOwner((req) => req.registrationOwnerId),
  async (req, res, next) => {
    try {
      const result = await query("DELETE FROM event_registrations WHERE id = $1", [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Event registration not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
