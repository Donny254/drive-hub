import { Router } from "express";
import crypto from "crypto";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner, requireRole } from "../middleware/auth.js";

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

const toTicketApi = (row) => ({
  id: row.id,
  registrationId: row.registration_id,
  eventId: row.event_id,
  userId: row.user_id,
  ticketNumber: row.ticket_number,
  status: row.status,
  checkedInAt: row.checked_in_at,
  checkedInBy: row.checked_in_by,
  createdAt: row.created_at,
});

const generateTicketNumber = () => `EVT-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const createTicketsForRegistration = async ({ registrationId, eventId, userId, count }) => {
  if (count <= 0) return [];
  const created = [];
  for (let i = 0; i < count; i += 1) {
    let inserted = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      const ticketNumber = generateTicketNumber();
      const result = await query(
        `INSERT INTO event_tickets (registration_id, event_id, user_id, ticket_number, status)
         VALUES ($1, $2, $3, $4, 'issued')
         ON CONFLICT (ticket_number) DO NOTHING
         RETURNING *`,
        [registrationId, eventId, userId, ticketNumber]
      );
      if (result.rowCount > 0) {
        inserted = result.rows[0];
      }
    }
    if (!inserted) {
      throw new Error("Failed to generate unique ticket number");
    }
    created.push(inserted);
  }
  return created;
};

const syncTicketsForRegistration = async ({ registrationId, eventId, userId, targetCount }) => {
  const ticketsResult = await query(
    "SELECT * FROM event_tickets WHERE registration_id = $1 ORDER BY created_at DESC",
    [registrationId]
  );
  const current = ticketsResult.rows;
  const diff = targetCount - current.length;
  if (diff > 0) {
    await createTicketsForRegistration({ registrationId, eventId, userId, count: diff });
  } else if (diff < 0) {
    const toRemove = current.slice(0, Math.abs(diff));
    const hasNonIssued = toRemove.some((ticket) => ticket.status !== "issued");
    if (hasNonIssued) {
      const error = new Error("Cannot reduce tickets after check-in/cancellation");
      error.status = 400;
      throw error;
    }
    await query(
      "DELETE FROM event_tickets WHERE id = ANY($1::uuid[])",
      [toRemove.map((ticket) => ticket.id)]
    );
  }
};

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

    const eventResult = await query("SELECT id, status FROM events WHERE id = $1", [eventId]);
    if (eventResult.rowCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    if (eventResult.rows[0].status !== "upcoming") {
      return res.status(400).json({ error: "Event is not open for registration" });
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

    const registration = insertResult.rows[0];
    const createdTickets = await createTicketsForRegistration({
      registrationId: registration.id,
      eventId: registration.event_id,
      userId: registration.user_id,
      count: registration.tickets,
    });

    res.status(201).json({
      ...toApi(registration),
      generatedTickets: createdTickets.map(toTicketApi),
    });
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

      const currentResult = await query("SELECT * FROM event_registrations WHERE id = $1", [req.params.id]);
      if (currentResult.rowCount === 0) {
        return res.status(404).json({ error: "Event registration not found" });
      }
      const current = currentResult.rows[0];

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
      const updated = result.rows[0];

      if (tickets !== undefined) {
        await syncTicketsForRegistration({
          registrationId: updated.id,
          eventId: updated.event_id,
          userId: updated.user_id,
          targetCount: updated.tickets,
        });
      }

      if (status === "cancelled") {
        await query(
          "UPDATE event_tickets SET status = 'cancelled', checked_in_at = NULL, checked_in_by = NULL WHERE registration_id = $1",
          [updated.id]
        );
      }

      res.json(toApi(updated));
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/registration/:id/tickets",
  requireAuth,
  loadOwner,
  requireAdminOrOwner((req) => req.registrationOwnerId),
  async (req, res, next) => {
    try {
      const result = await query(
        "SELECT * FROM event_tickets WHERE registration_id = $1 ORDER BY created_at ASC",
        [req.params.id]
      );
      return res.json(result.rows.map(toTicketApi));
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/tickets/mine", requireAuth, async (req, res, next) => {
  try {
    const params = [req.user.id];
    let where = "WHERE t.user_id = $1";
    if (req.query.eventId) {
      params.push(req.query.eventId);
      where += ` AND t.event_id = $${params.length}`;
    }
    const result = await query(
      `SELECT t.*, e.title AS event_title
       FROM event_tickets t
       LEFT JOIN events e ON e.id = t.event_id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );
    return res.json(
      result.rows.map((row) => ({
        ...toTicketApi(row),
        eventTitle: row.event_title || null,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/tickets/:ticketNumber/check-in", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const ticketNumber = String(req.params.ticketNumber || "").trim().toUpperCase();
    if (!ticketNumber) {
      return res.status(400).json({ error: "ticketNumber is required" });
    }

    const ticketResult = await query("SELECT * FROM event_tickets WHERE ticket_number = $1", [ticketNumber]);
    if (ticketResult.rowCount === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    const ticket = ticketResult.rows[0];

    if (ticket.status === "cancelled") {
      return res.status(400).json({ error: "Ticket is cancelled" });
    }
    if (ticket.status === "checked_in") {
      return res.status(409).json({ error: "Ticket already checked in" });
    }

    const registrationResult = await query(
      "SELECT id, status FROM event_registrations WHERE id = $1",
      [ticket.registration_id]
    );
    if (registrationResult.rowCount === 0) {
      return res.status(404).json({ error: "Registration not found for ticket" });
    }
    if (registrationResult.rows[0].status === "cancelled") {
      return res.status(400).json({ error: "Registration is cancelled" });
    }

    const updateResult = await query(
      `UPDATE event_tickets
       SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
       WHERE id = $2
       RETURNING *`,
      [req.user.id, ticket.id]
    );
    return res.json(toTicketApi(updateResult.rows[0]));
  } catch (error) {
    return next(error);
  }
});

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
