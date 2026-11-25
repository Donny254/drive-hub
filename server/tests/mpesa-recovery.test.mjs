import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testDatabaseUrl = process.env.MPESA_TEST_DATABASE_URL;

test(
  "recovery worker processes a stored callback exactly once under concurrent polling",
  { skip: !testDatabaseUrl },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const { query } = await import("../src/db.js");
    const { processRecoveryBatch } = await import(
      "../src/utils/mpesaRecovery.js"
    );

    const id = randomUUID();
    let processorCalls = 0;

    try {
      await query(
        `INSERT INTO mpesa_callback_inbox
           (id, callback_type, provider_reference, payload)
         VALUES ($1, 'pull', $2, $3::jsonb)`,
        [id, `TEST-${id}`, JSON.stringify({ test: true })]
      );

      const processor = async (record) => {
        assert.equal(record.id, id);
        processorCalls += 1;

        await new Promise((resolve) => setTimeout(resolve, 150));
      };

      const results = await Promise.all([
        processRecoveryBatch(processor),
        processRecoveryBatch(processor),
      ]);

      const totalClaimed = results.reduce(
        (sum, result) => sum + result.claimed,
        0
      );

      assert.equal(totalClaimed, 1);
      assert.equal(processorCalls, 1);

      const stored = await query(
        `SELECT processing_status, processing_attempts
         FROM mpesa_callback_inbox
         WHERE id = $1`,
        [id]
      );

      assert.equal(stored.rows[0].processing_status, "processed");
      assert.equal(Number(stored.rows[0].processing_attempts), 1);
    } finally {
      await query(
        "DELETE FROM mpesa_callback_inbox WHERE id = $1",
        [id]
      );
    }
  }
);

test(
  "recovery worker schedules a failed callback for retry",
  { skip: !testDatabaseUrl },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const { query } = await import("../src/db.js");
    const { processRecoveryBatch } = await import(
      "../src/utils/mpesaRecovery.js"
    );

    const id = randomUUID();

    try {
      await query(
        `INSERT INTO mpesa_callback_inbox
           (id, callback_type, provider_reference, payload)
         VALUES ($1, 'pull', $2, $3::jsonb)`,
        [id, `TEST-${id}`, JSON.stringify({ test: true })]
      );

      const result = await processRecoveryBatch(async () => {
        throw new Error("Simulated Daraja processing failure");
      });

      assert.equal(result.claimed, 1);
      assert.equal(result.retrying, 1);

      const stored = await query(
        `SELECT processing_status, processing_attempts,
                processing_error, next_retry_at
         FROM mpesa_callback_inbox
         WHERE id = $1`,
        [id]
      );

      assert.equal(stored.rows[0].processing_status, "retry");
      assert.equal(Number(stored.rows[0].processing_attempts), 1);
      assert.match(
        stored.rows[0].processing_error,
        /Simulated Daraja processing failure/
      );
      assert.ok(stored.rows[0].next_retry_at);
    } finally {
      await query(
        "DELETE FROM mpesa_callback_inbox WHERE id = $1",
        [id]
      );
    }
  }
);
