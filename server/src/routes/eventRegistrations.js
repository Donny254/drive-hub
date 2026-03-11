import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdminOrOwner, requireRole } from "../middleware/auth.js";
import { sendEventTicketEmail } from "../email.js";
import { sendEventTicketMessage } from "../notifications.js";
import {
  issueTicketsForRegistration,
  syncTicketsForRegistration,
  toTicketApi,
} from "../utils/eventTickets.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  eventId: row.event_id,
  eventTitle: row.event_title || null,
  eventLocation: row.event_location || null,
  eventStartDate: row.event_start_date || null,
  eventEndDate: row.event_end_date || null,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  tickets: row.tickets,
  amountCents: Number(row.amount_cents || 0),
  paymentMethod: row.payment_method || null,
  paymentStatus: row.payment_status || "unpaid",
  paidAt: row.paid_at,
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
        `SELECT er.*, e.title AS event_title, e.location AS event_location, e.start_date AS event_start_date, e.end_date AS event_end_date
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
      `SELECT er.*, e.title AS event_title, e.location AS event_location, e.start_date AS event_start_date, e.end_date AS event_end_date
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

    const requestedTickets = Number.isInteger(tickets) ? tickets : 1;

    const eventResult = await query("SELECT id, status, price_cents FROM events WHERE id = $1", [eventId]);
    if (eventResult.rowCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    const event = eventResult.rows[0];
    if (event.status !== "upcoming") {
      return res.status(400).json({ error: "Event is not open for registration" });
    }
    const amountCents = Number(event.price_cents || 0) * requestedTickets;
    const isFreeEvent = amountCents <= 0;

    const insertResult = await query(
      `INSERT INTO event_registrations
       (user_id, event_id, contact_name, contact_phone, tickets, amount_cents, payment_method, payment_status, paid_at, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.id,
        eventId,
        contactName || null,
        contactPhone || null,
        requestedTickets,
        amountCents,
        isFreeEvent ? "free" : "mpesa",
        isFreeEvent ? "paid" : "unpaid",
        isFreeEvent ? new Date().toISOString() : null,
        notes || null,
        isFreeEvent ? "confirmed" : "pending",
      ]
    );

    const registration = insertResult.rows[0];
    const createdTickets = isFreeEvent ? await issueTicketsForRegistration(registration) : [];

    if (isFreeEvent && createdTickets.length > 0) {
      try {
        const notifyResult = await query(
          `SELECT u.email, u.name, e.title, e.location, e.start_date, e.end_date
           FROM users u
           LEFT JOIN events e ON e.id = $1
           WHERE u.id = $2`,
          [eventId, req.user.id]
        );
        if (notifyResult.rowCount > 0) {
          const notify = notifyResult.rows[0];
          await sendEventTicketEmail({
            to: notify.email,
            attendeeName: contactName || notify.name,
            registration: {
              tickets: registration.tickets,
              paymentMethod: registration.payment_method,
              paymentStatus: registration.payment_status,
            },
            event: {
              title: notify.title,
              location: notify.location,
              startDate: notify.start_date,
              endDate: notify.end_date,
            },
            tickets: createdTickets.map(toTicketApi),
          });
          await sendEventTicketMessage({
            phone: registration.contact_phone,
            attendeeName: contactName || notify.name,
            eventTitle: notify.title,
            ticketCodes: createdTickets.map((ticket) => ticket.ticketNumber),
          });
        }
      } catch (mailError) {
        console.warn("Event ticket email failed:", mailError);
      }
    }

    res.status(201).json({
      ...toApi(registration),
      paymentRequired: !isFreeEvent,
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
        const eventResult = await query("SELECT price_cents FROM events WHERE id = $1", [current.event_id]);
        const eventPriceCents = eventResult.rowCount > 0 ? Number(eventResult.rows[0].price_cents || 0) : 0;
        maybeSet("amount_cents", eventPriceCents * tickets);
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

      if (tickets !== undefined && updated.payment_status === "paid" && updated.status !== "cancelled") {
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
