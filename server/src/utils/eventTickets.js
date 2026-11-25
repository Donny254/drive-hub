import crypto from "crypto";
import { withTransaction } from "../db.js";

const generateTicketNumber = () =>
  `EVT-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

const lockRegistration = async (client, registrationId) => {
  const result = await client.query(
    `SELECT id, event_id, user_id, tickets, status, payment_status,
            amount_cents
     FROM event_registrations
     WHERE id = $1
     FOR UPDATE`,
    [registrationId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Event registration not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
};

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

const createTicketsWithClient = async ({
  client,
  registrationId,
  eventId,
  userId,
  count,
}) => {
  if (count <= 0) return [];

  const created = [];

  for (let i = 0; i < count; i += 1) {
    let inserted = null;

    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      const ticketNumber = generateTicketNumber();

      const result = await client.query(
        `INSERT INTO event_tickets
           (registration_id, event_id, user_id, ticket_number, status)
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

export const createTicketsForRegistration = async ({
  registrationId,
  eventId,
  userId,
  count,
  client = null,
}) => {
  if (client) {
    return createTicketsWithClient({
      client,
      registrationId,
      eventId,
      userId,
      count,
    });
  }

  return withTransaction((tx) =>
    createTicketsWithClient({
      client: tx,
      registrationId,
      eventId,
      userId,
      count,
    })
  );
};

const syncTicketsWithClient = async ({
  client,
  registration,
  targetCount,
}) => {
  if (!Number.isSafeInteger(targetCount) || targetCount < 0) {
    throw new Error("targetCount must be a non-negative integer");
  }

  const ticketsResult = await client.query(
    `SELECT *
     FROM event_tickets
     WHERE registration_id = $1
     ORDER BY created_at DESC, id DESC
     FOR UPDATE`,
    [registration.id]
  );

  const current = ticketsResult.rows;
  const diff = targetCount - current.length;

  if (diff > 0) {
    await createTicketsWithClient({
      client,
      registrationId: registration.id,
      eventId: registration.event_id,
      userId: registration.user_id,
      count: diff,
    });
  } else if (diff < 0) {
    const toRemove = current.slice(0, Math.abs(diff));

    if (toRemove.some((ticket) => ticket.status !== "issued")) {
      const error = new Error(
        "Cannot reduce tickets after check-in/cancellation"
      );
      error.status = 400;
      throw error;
    }

    await client.query(
      "DELETE FROM event_tickets WHERE id = ANY($1::uuid[])",
      [toRemove.map((ticket) => ticket.id)]
    );
  }

  const finalResult = await client.query(
    `SELECT *
     FROM event_tickets
     WHERE registration_id = $1
     ORDER BY created_at ASC, id ASC`,
    [registration.id]
  );

  return finalResult.rows;
};

export const syncTicketsForRegistration = async ({
  registrationId,
  eventId,
  userId,
  targetCount,
  client = null,
}) => {
  if (!Number.isSafeInteger(targetCount) || targetCount < 0) {
    throw new Error("targetCount must be a non-negative integer");
  }

  const sync = async (tx) => {
    const registration = await lockRegistration(tx, registrationId);

    return syncTicketsWithClient({
      client: tx,
      registration: {
        ...registration,
        event_id: registration.event_id || eventId,
        user_id: registration.user_id || userId,
      },
      targetCount,
    });
  };

  if (client) return sync(client);

  return withTransaction(sync);
};

export const issueTicketsForRegistration = async (registration) => {
  if (!registration?.id) {
    throw new Error("A valid registration is required to issue tickets");
  }

  return withTransaction(async (client) => {
    const lockedRegistration = await lockRegistration(
      client,
      registration.id
    );

    if (lockedRegistration.status === "cancelled") {
      return [];
    }

    if (
      lockedRegistration.payment_status !== "paid" &&
      Number(lockedRegistration.amount_cents || 0) > 0
    ) {
      const error = new Error(
        "Tickets cannot be issued before payment is confirmed"
      );
      error.status = 409;
      throw error;
    }

    return syncTicketsWithClient({
      client,
      registration: lockedRegistration,
      targetCount: Number(lockedRegistration.tickets),
    });
  });
};
