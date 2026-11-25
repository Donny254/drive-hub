import { withTransaction } from "../db.js";

const positiveInteger = (value, fallback, minimum = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  return Number.isSafeInteger(parsed) && parsed >= minimum
    ? parsed
    : fallback;
};

const MAX_ATTEMPTS = positiveInteger(
  process.env.MPESA_CALLBACK_MAX_ATTEMPTS,
  12
);

const BATCH_SIZE = positiveInteger(
  process.env.MPESA_CALLBACK_BATCH_SIZE,
  20
);

const POLL_MS = positiveInteger(
  process.env.MPESA_RECOVERY_POLL_MS,
  15000,
  1000
);

const ABANDONED_AFTER_MINUTES = positiveInteger(
  process.env.MPESA_CALLBACK_ABANDONED_MINUTES,
  15
);

const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  300_000,
  900_000,
  1_800_000,
  3_600_000,
];

const retryDelayMs = (attempt) => {
  const index = Math.min(
    Math.max(attempt - 1, 0),
    RETRY_DELAYS_MS.length - 1
  );

  return RETRY_DELAYS_MS[index];
};

let running = false;
let timer = null;
let activeRun = null;

const claimBatch = async () =>
  withTransaction(async (client) => {
    // Recover records left in "processing" after a worker crash.
    // The age threshold avoids immediately stealing work from another worker.
    await client.query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = CASE
             WHEN processing_attempts >= $1 THEN 'failed'
             ELSE 'retry'
           END,
           next_retry_at = CASE
             WHEN processing_attempts >= $1 THEN NULL
             ELSE now()
           END,
           processing_error = COALESCE(
             processing_error,
             'Recovered abandoned callback processing'
           )
       WHERE processing_status = 'processing'
         AND (
           last_attempt_at IS NULL
           OR last_attempt_at <
             now() - ($2::integer * interval '1 minute')
         )`,
      [MAX_ATTEMPTS, ABANDONED_AFTER_MINUTES]
    );

    // SKIP LOCKED allows separate application instances to claim
    // different batches without processing the same row concurrently.
    const selected = await client.query(
      `SELECT id
       FROM mpesa_callback_inbox
       WHERE processing_status IN ('received', 'retry')
         AND processing_attempts < $2
         AND COALESCE(next_retry_at, received_at) <= now()
       ORDER BY received_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE, MAX_ATTEMPTS]
    );

    if (selected.rowCount === 0) {
      return [];
    }

    const ids = selected.rows.map((row) => row.id);
    const claimed = await client.query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processing',
           processing_attempts = processing_attempts + 1,
           last_attempt_at = now()
       WHERE id = ANY($1::uuid[])
       RETURNING
         id,
         callback_type,
         provider_reference,
         payload,
         processing_attempts`,
      [ids]
    );

    return claimed.rows;
  });

const markProcessed = async (id) => {
  const result = await withTransaction((client) =>
    client.query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processed',
           processing_error = NULL,
           next_retry_at = NULL,
           processed_at = now()
       WHERE id = $1
         AND processing_status = 'processing'
       RETURNING id`,
      [id]
    )
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `Callback ${id} was not marked processed because it was no longer claimed`
    );
  }
};

const markFailed = async (id, error) => {
  const message = String(
    error?.message || error || "Callback requires manual review"
  ).slice(0, 2000);

  await withTransaction((client) =>
    client.query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'failed',
           processing_error = $2,
           next_retry_at = NULL
       WHERE id = $1
         AND processing_status = 'processing'`,
      [id, message]
    )
  );
};

const markRetry = async (id, attempts, error) => {
  const message = String(
    error?.message || error || "Unknown callback processing error"
  ).slice(0, 2000);

  if (attempts >= MAX_ATTEMPTS) {
    await markFailed(id, message);
    return "failed";
  }

  const delay = retryDelayMs(attempts);
  await withTransaction((client) =>
    client.query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'retry',
           processing_error = $2,
           next_retry_at =
             now() + ($3::integer * interval '1 millisecond')
       WHERE id = $1
         AND processing_status = 'processing'`,
      [id, message, delay]
    )
  );

  return "retry";
};

export const processRecoveryBatch = async (processor) => {
  if (typeof processor !== "function") {
    throw new TypeError("Callback processor must be a function");
  }

  const batch = await claimBatch();

  let processed = 0;
  let retrying = 0;
  let permanentlyFailed = 0;

  for (const record of batch) {
    try {
      const result = await processor(record);
      if (result?.manualReview) {
        await markFailed(record.id, result.message);
        permanentlyFailed += 1;
        continue;
      }

      await markProcessed(record.id);
      processed += 1;
    } catch (error) {
      let outcome = "retry";

      try {
        outcome = await markRetry(
          record.id,
          record.processing_attempts,
          error
        );
      } catch (updateError) {
        console.error(
          "[M-Pesa recovery] Could not update callback status",
          record.id,
          updateError?.message || updateError
        );
      }

      if (outcome === "failed") {
        permanentlyFailed += 1;
      } else {
        retrying += 1;
      }

      console.error(
        "[M-Pesa recovery] Callback processing failed",
        record.id,
        error?.message || error
      );
    }
  }

  return {
    claimed: batch.length,
    processed,
    retrying,
    permanentlyFailed,
  };
};

export const startMpesaRecovery = (processor) => {
  if (running) {
    return;
  }

  if (typeof processor !== "function") {
    throw new TypeError("Callback processor must be a function");
  }

  running = true;

  const run = async () => {
    if (!running) {
      return;
    }

    try {
      const result = await processRecoveryBatch(processor);

      if (result.claimed > 0) {
        console.info("[M-Pesa recovery]", result);
      }
    } catch (error) {
      console.error(
        "[M-Pesa recovery] Batch failed:",
        error?.message || error
      );
    } finally {
      activeRun = null;

      if (running) {
        timer = setTimeout(() => {
          activeRun = run();
        }, POLL_MS);
      }
    }
  };

  activeRun = run();
};

// Stops polling and returns the active batch promise for graceful shutdown.
export const stopMpesaRecovery = () => {
  running = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  return activeRun || Promise.resolve();
};
