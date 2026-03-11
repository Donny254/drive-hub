import crypto from "crypto";
import { query } from "../db.js";

const generateTicketNumber = () => `EVT-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

export const toTicketApi = (row) => ({
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

export const createTicketsForRegistration = async ({ registrationId, eventId, userId, count }) => {
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

export const syncTicketsForRegistration = async ({ registrationId, eventId, userId, targetCount }) => {
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
    await query("DELETE FROM event_tickets WHERE id = ANY($1::uuid[])", [
      toRemove.map((ticket) => ticket.id),
    ]);
  }
};

export const issueTicketsForRegistration = async (registration) => {
  await syncTicketsForRegistration({
    registrationId: registration.id,
    eventId: registration.event_id,
    userId: registration.user_id,
    targetCount: registration.tickets,
  });
  const ticketsResult = await query(
    "SELECT * FROM event_tickets WHERE registration_id = $1 ORDER BY created_at ASC",
    [registration.id]
  );
  return ticketsResult.rows;
};
