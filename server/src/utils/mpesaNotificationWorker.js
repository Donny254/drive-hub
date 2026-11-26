import { query } from "../db.js";
import { sendEventTicketEmail } from "../email.js";
import { sendEventTicketChannelMessage } from "../notifications.js";
import { issueTicketsForRegistration } from "./eventTickets.js";

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

let timer = null;
let activeRun = null;
let stopping = false;

const recoverExpiredJobs = async () => {
  const leaseMinutes = positiveInteger(
    process.env.MPESA_NOTIFICATION_LEASE_MINUTES,
    15
  );

  await query(
    `UPDATE event_ticket_notification_outbox
     SET status = CASE
           WHEN attempts >= max_attempts THEN 'failed'
           ELSE 'retry'
         END,
         locked_at = NULL,
         next_retry_at = CASE
           WHEN attempts >= max_attempts THEN next_retry_at
           ELSE now()
         END,
         last_error = COALESCE(
           last_error,
           'Notification worker lease expired.'
         ),
         updated_at = now()
     WHERE status = 'processing'
       AND (
         locked_at IS NULL
         OR locked_at < now() - ($1::integer * interval '1 minute')
       )`,
    [leaseMinutes]
  );
};

const claimBatch = async () => {
  const batchSize = positiveInteger(
    process.env.MPESA_NOTIFICATION_BATCH_SIZE,
    10
  );
  const result = await query(
    `WITH candidates AS (
       SELECT id
       FROM event_ticket_notification_outbox
       WHERE status IN ('pending', 'retry')
         AND next_retry_at <= now()
         AND attempts < max_attempts
       ORDER BY next_retry_at ASC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE event_ticket_notification_outbox AS outbox
     SET status = 'processing',
         attempts = outbox.attempts + 1,
         locked_at = now(),
         updated_at = now()
     FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.*`,
    [batchSize]
  );

  return result.rows;
};

const loadRegistration = async (registrationId) => {
  const result = await query(
    `SELECT er.*,
            u.email,
            u.name,
            e.title AS event_title,
            e.location AS event_location,
            e.start_date,
            e.end_date
     FROM event_registrations er
     LEFT JOIN users u ON u.id = er.user_id
     LEFT JOIN events e ON e.id = er.event_id
     WHERE er.id = $1`,
    [registrationId]
  );

  if (!result.rowCount) {
    throw new Error(`Registration ${registrationId} not found.`);
  }

  return result.rows[0];
};

const markSkipped = async (job, reason) => {
  const result = await query(
    `UPDATE event_ticket_notification_outbox
     SET status = 'skipped',
         locked_at = NULL,
         last_error = $2,
         updated_at = now()
     WHERE id = $1
       AND status = 'processing'`,
    [job.id, reason]
  );

  if (result.rowCount !== 1) {
    throw new Error(`Notification job ${job.id} is no longer claimed.`);
  }
};

const markSent = async (job) => {
  const result = await query(
    `UPDATE event_ticket_notification_outbox
     SET status = 'sent',
         locked_at = NULL,
         sent_at = now(),
         last_error = NULL,
         updated_at = now()
     WHERE id = $1
       AND status = 'processing'`,
    [job.id]
  );

  if (result.rowCount !== 1) {
    throw new Error(`Notification job ${job.id} is no longer claimed.`);
  }
};

const scheduleRetry = async (job, error) => {
  const message = String(
    error?.message || error || "Notification delivery failed."
  ).slice(0, 2000);
  const exhausted = Number(job.attempts) >= Number(job.max_attempts);
  const delayMinutes = Math.min(
    360,
    2 ** Math.min(Number(job.attempts || 1), 8)
  );

  const result = await query(
    `UPDATE event_ticket_notification_outbox
     SET status = $2,
         locked_at = NULL,
         next_retry_at = CASE
           WHEN $2 = 'retry'
             THEN now() + ($3::integer * interval '1 minute')
           ELSE next_retry_at
         END,
         last_error = $4,
         updated_at = now()
     WHERE id = $1
       AND status = 'processing'`,
    [
      job.id,
      exhausted ? "failed" : "retry",
      delayMinutes,
      message,
    ]
  );

  if (result.rowCount !== 1) {
    throw new Error(`Notification job ${job.id} is no longer claimed.`);
  }
};

const sendNotification = async (job, registration, tickets) => {
  const ticketCodes = tickets.map(
    (ticket) => ticket.ticket_number || ticket.ticketNumber
  );

  if (job.channel === "email") {
    const sent = await sendEventTicketEmail({
      to: registration.email,
      attendeeName: registration.name,
      registration: {
        tickets: registration.tickets,
        paymentMethod: registration.payment_method,
        paymentStatus: registration.payment_status,
      },
      event: {
        title: registration.event_title,
        location: registration.event_location,
        startDate: registration.start_date,
        endDate: registration.end_date,
      },
      tickets,
    });

    if (!sent) {
      throw new Error("Email provider did not confirm delivery.");
    }

    return;
  }

  await sendEventTicketChannelMessage({
    channel: job.channel,
    phone: registration.contact_phone,
    attendeeName: registration.name,
    eventTitle: registration.event_title,
    ticketCodes,
    throwOnError: true,
  });
};

const processJob = async (job) => {
  try {
    let registration = await loadRegistration(job.registration_id);

    if (registration.payment_status !== "paid") {
      throw new Error(
        `Registration ${job.registration_id} is not marked paid.`
      );
    }

    if (registration.status === "cancelled") {
      await markSkipped(job, "Registration is cancelled.");
      return;
    }

    const tickets = await issueTicketsForRegistration(registration);
    registration = await loadRegistration(job.registration_id);

    if (registration.status === "cancelled") {
      await markSkipped(job, "Registration is cancelled.");
      return;
    }

    if (registration.payment_status !== "paid") {
      throw new Error(
        `Registration ${job.registration_id} is not marked paid.`
      );
    }

    const recipient =
      job.channel === "email"
        ? String(registration.email || "").trim()
        : String(registration.contact_phone || "").trim();

    if (!recipient) {
      await markSkipped(job, `No ${job.channel} recipient is available.`);
      return;
    }

    await sendNotification(job, registration, tickets);
    await markSent(job);

    console.info(
      `Event ticket ${job.channel} notification ${job.id} delivered.`
    );
  } catch (error) {
    await scheduleRetry(job, error);
    console.error(
      `Event ticket ${job.channel} notification ${job.id} failed:`,
      String(error?.message || error)
    );
  }
};

const runWorker = async () => {
  if (stopping) return;

  await recoverExpiredJobs();
  const jobs = await claimBatch();

  // Finish all rows claimed in this batch before completing shutdown.
  for (const job of jobs) {
    await processJob(job);
  }
};

const tick = async () => {
  if (activeRun || stopping) return;

  activeRun = runWorker()
    .catch((error) => {
      console.error("Event ticket notification worker error:", error);
    })
    .finally(() => {
      activeRun = null;
    });

  await activeRun;
};

export const startMpesaNotificationWorker = () => {
  if (timer) return;

  stopping = false;
  const pollMs = Math.max(
    1000,
    positiveInteger(process.env.MPESA_NOTIFICATION_POLL_MS, 15000)
  );

  timer = setInterval(() => {
    void tick();
  }, pollMs);
  timer.unref?.();

  void tick();

  console.info("Event ticket notification worker started.");
};

export const stopMpesaNotificationWorker = async () => {
  stopping = true;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (activeRun) {
    await activeRun;
  }

  console.info("Event ticket notification worker stopped.");
};
