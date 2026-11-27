import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testDatabaseUrl = process.env.MPESA_TEST_DATABASE_URL;

const loadMpesaTestContext = async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const [{ query }, payments] = await Promise.all([
    import("../src/db.js"),
    import("../src/routes/payments.js"),
  ]);
  return { query, payments };
};

const insertTransaction = async (
  query,
  {
    id = randomUUID(),
    checkoutRequestId = null,
    bookingId = null,
    eventRegistrationId = null,
    credentialProfileId = null,
  } = {}
) => {
  await query(
    `INSERT INTO mpesa_transactions (
       id,
       booking_id,
       event_registration_id,
       phone_number,
       amount_cents,
       status,
       checkout_request_id,
       mpesa_environment,
       transaction_type,
       credential_profile_id
     )
     VALUES ($1, $2, $3, '254712345678', 100, 'pending', $4, 'sandbox',
             'CustomerPayBillOnline', $5)`,
    [
      id,
      bookingId,
      eventRegistrationId,
      checkoutRequestId,
      credentialProfileId,
    ]
  );
  return id;
};

const deletePaymentFixtures = async (
  query,
  { transactionIds = [], bookingIds = [], registrationIds = [] } = {}
) => {
  if (transactionIds.length) {
    await query(
      "DELETE FROM mpesa_transactions WHERE id = ANY($1::uuid[])",
      [transactionIds]
    );
  }
  if (bookingIds.length) {
    await query("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [bookingIds]);
  }
  if (registrationIds.length) {
    await query(
      "DELETE FROM event_registrations WHERE id = ANY($1::uuid[])",
      [registrationIds]
    );
  }
};

const createStkCallback = (checkoutRequestId, resultCode = "0") => ({
  Body: {
    stkCallback: {
      CheckoutRequestID: checkoutRequestId,
      ResultCode: resultCode,
      ResultDesc: "Test callback",
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 1 },
          { Name: "MpesaReceiptNumber", Value: `TEST${randomUUID().slice(0, 8)}` },
        ],
      },
    },
  },
});

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

test(
  "processing the same STK callback twice settles the transaction once",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const transactionId = randomUUID();
    const checkoutRequestId = `TEST-${randomUUID()}`;

    try {
      await insertTransaction(query, {
        id: transactionId,
        checkoutRequestId,
      });

      const inbox = {
        callback_type: "stk",
        payload: createStkCallback(checkoutRequestId),
      };
      const first = await payments.processStoredDarajaCallback(inbox);
      const second = await payments.processStoredDarajaCallback(inbox);

      assert.equal(first.processed, true);
      assert.equal(second.processed, true);
      assert.match(second.message, /already paid/);

      const saved = await query(
        `SELECT status, response
         FROM mpesa_transactions
         WHERE id = $1`,
        [transactionId]
      );
      assert.equal(saved.rows[0].status, "paid");
      assert.ok(saved.rows[0].response.callback);
    } finally {
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
      });
    }
  }
);

test(
  "concurrent M-Pesa settlements claim a transaction once",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const transactionId = randomUUID();

    try {
      await insertTransaction(query, { id: transactionId });

      const results = await Promise.all([
        payments.settleMpesaTransaction({
          transactionId,
          status: "paid",
          metadata: { mpesaReceiptNumber: `TEST${randomUUID().slice(0, 8)}` },
          rawPayload: { ResultCode: "0" },
          source: "test_callback",
        }),
        payments.settleMpesaTransaction({
          transactionId,
          status: "paid",
          metadata: { mpesaReceiptNumber: `TEST${randomUUID().slice(0, 8)}` },
          rawPayload: { ResultCode: "0" },
          source: "test_reconciliation",
        }),
      ]);

      assert.equal(
        results.filter((result) => result.settled).length,
        1
      );
      const saved = await query(
        "SELECT status FROM mpesa_transactions WHERE id = $1",
        [transactionId]
      );
      assert.equal(saved.rows[0].status, "paid");
    } finally {
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
      });
    }
  }
);

const assertMissingLinkedTargetBlocksSettlement = async ({
  targetColumn,
  targetTable,
  errorPattern,
}) => {
  const { query, payments } = await loadMpesaTestContext();
  const transactionId = randomUUID();
  const targetId = randomUUID();
  const escapedColumn = targetColumn.replaceAll('"', '""');
  const constraintResult = await query(
    `SELECT conname, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'mpesa_transactions'::regclass
       AND contype = 'f'
       AND position('(${targetColumn})' IN pg_get_constraintdef(oid)) > 0
       AND position('REFERENCES ${targetTable}' IN pg_get_constraintdef(oid)) > 0
     LIMIT 1`
  );
  const constraint = constraintResult.rows[0] || null;
  const quotedConstraint = constraint
    ? `"${constraint.conname.replaceAll('"', '""')}"`
    : null;
  let constraintDropped = false;
  let invalidConstraintAdded = false;

  try {
    if (constraint) {
      await query(
        `ALTER TABLE mpesa_transactions DROP CONSTRAINT ${quotedConstraint}`
      );
      constraintDropped = true;
    }

    await query(
      `INSERT INTO mpesa_transactions (
         id, ${escapedColumn}, phone_number, amount_cents, status,
         mpesa_environment, transaction_type
       )
       VALUES ($1, $2, '254712345678', 100, 'pending', 'sandbox',
               'CustomerPayBillOnline')`,
      [transactionId, targetId]
    );

    if (constraint) {
      await query(
        `ALTER TABLE mpesa_transactions
         ADD CONSTRAINT ${quotedConstraint}
         ${constraint.definition} NOT VALID`
      );
      invalidConstraintAdded = true;
    }

    await assert.rejects(
      payments.settleMpesaTransaction({
        transactionId,
        status: "paid",
        rawPayload: { ResultCode: "0" },
        source: "test_missing_target",
      }),
      errorPattern
    );

    const saved = await query(
      "SELECT status FROM mpesa_transactions WHERE id = $1",
      [transactionId]
    );
    assert.equal(saved.rows[0].status, "pending");
  } finally {
    await query("DELETE FROM mpesa_transactions WHERE id = $1", [
      transactionId,
    ]);

    if (constraint && constraintDropped) {
      if (invalidConstraintAdded) {
        await query(
          `ALTER TABLE mpesa_transactions DROP CONSTRAINT ${quotedConstraint}`
        );
      }
      await query(
        `ALTER TABLE mpesa_transactions
         ADD CONSTRAINT ${quotedConstraint} ${constraint.definition}`
      );
    }
  }
};

test(
  "settlement rolls back when its linked booking is missing",
  { skip: !testDatabaseUrl },
  async () => {
    await assertMissingLinkedTargetBlocksSettlement({
      targetColumn: "booking_id",
      targetTable: "bookings",
      errorPattern: /Booking .* no longer exists/,
    });
  }
);

test(
  "settlement rolls back when its linked event registration is missing",
  { skip: !testDatabaseUrl },
  async () => {
    await assertMissingLinkedTargetBlocksSettlement({
      targetColumn: "event_registration_id",
      targetTable: "event_registrations",
      errorPattern: /Event registration .* no longer exists/,
    });
  }
);

test(
  "paid cancelled booking is marked for manual review",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const bookingId = randomUUID();
    const transactionId = randomUUID();

    try {
      await query(
        `INSERT INTO bookings (id, status, payment_status, amount_cents)
         VALUES ($1, 'cancelled', 'pending', 100)`,
        [bookingId]
      );
      await insertTransaction(query, { id: transactionId, bookingId });

      const result = await payments.settleMpesaTransaction({
        transactionId,
        status: "paid",
        metadata: { mpesaReceiptNumber: `TEST${randomUUID().slice(0, 8)}` },
        rawPayload: { ResultCode: "0" },
        source: "test_cancelled_booking",
      });

      assert.equal(result.settled, true);
      const [transaction, booking] = await Promise.all([
        query(
          `SELECT response
           FROM mpesa_transactions
           WHERE id = $1`,
          [transactionId]
        ),
        query(
          `SELECT status, payment_status
           FROM bookings
           WHERE id = $1`,
          [bookingId]
        ),
      ]);
      assert.equal(
        transaction.rows[0].response.test_cancelled_booking.manualReview
          .reason,
        "payment_received_for_cancelled_booking"
      );
      assert.equal(booking.rows[0].status, "cancelled");
      assert.equal(booking.rows[0].payment_status, "paid");
    } finally {
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
        bookingIds: [bookingId],
      });
    }
  }
);

test(
  "paid cancelled event registration is marked for manual review",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const registrationId = randomUUID();
    const transactionId = randomUUID();

    try {
      await query(
        `INSERT INTO event_registrations (
           id, status, payment_status, amount_cents
         )
         VALUES ($1, 'cancelled', 'pending', 100)`,
        [registrationId]
      );
      await insertTransaction(query, {
        id: transactionId,
        eventRegistrationId: registrationId,
      });

      const result = await payments.settleMpesaTransaction({
        transactionId,
        status: "paid",
        metadata: { mpesaReceiptNumber: `TEST${randomUUID().slice(0, 8)}` },
        rawPayload: { ResultCode: "0" },
        source: "test_cancelled_registration",
      });

      assert.equal(result.settled, true);
      const [transaction, registration] = await Promise.all([
        query(
          `SELECT response
           FROM mpesa_transactions
           WHERE id = $1`,
          [transactionId]
        ),
        query(
          `SELECT status, payment_status
           FROM event_registrations
           WHERE id = $1`,
          [registrationId]
        ),
      ]);
      assert.equal(
        transaction.rows[0].response.test_cancelled_registration.manualReview
          .reason,
        "payment_received_for_cancelled_event_registration"
      );
      assert.equal(registration.rows[0].status, "cancelled");
      assert.equal(registration.rows[0].payment_status, "paid");
    } finally {
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
        registrationIds: [registrationId],
      });
    }
  }
);

test(
  "unresolved STK result code 2029 leaves the transaction pending",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const transactionId = randomUUID();
    const checkoutRequestId = `TEST-${randomUUID()}`;
    const payload = createStkCallback(checkoutRequestId, "2029");

    try {
      await insertTransaction(query, {
        id: transactionId,
        checkoutRequestId,
      });
      const result = await payments.processStoredDarajaCallback({
        callback_type: "stk",
        payload,
      });

      assert.equal(result.processed, false);
      assert.equal(result.manualReview, true);
      const saved = await query(
        `SELECT status, result_code
         FROM mpesa_transactions
         WHERE id = $1`,
        [transactionId]
      );
      assert.equal(saved.rows[0].status, "pending");
      assert.equal(saved.rows[0].result_code, "2029");
    } finally {
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
      });
    }
  }
);

test(
  "callback processing refuses duplicate CheckoutRequestIDs",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const transactionIds = [randomUUID(), randomUUID()];
    const checkoutRequestId = `TEST-${randomUUID()}`;
    const indexResult = await query(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = current_schema()
         AND indexname = 'uq_mpesa_checkout_request_id'`
    );
    const hadUniqueIndex = indexResult.rowCount > 0;

    try {
      if (hadUniqueIndex) {
        await query("DROP INDEX uq_mpesa_checkout_request_id");
      }
      await Promise.all(
        transactionIds.map((id) =>
          insertTransaction(query, { id, checkoutRequestId })
        )
      );

      await assert.rejects(
        payments.processStoredDarajaCallback({
          callback_type: "stk",
          payload: createStkCallback(checkoutRequestId, "2029"),
        }),
        /Multiple transactions match CheckoutRequestID/
      );
    } finally {
      await deletePaymentFixtures(query, { transactionIds });
      if (hadUniqueIndex) {
        await query(
          `CREATE UNIQUE INDEX uq_mpesa_checkout_request_id
           ON mpesa_transactions (checkout_request_id)
           WHERE checkout_request_id IS NOT NULL`
        );
      }
    }
  }
);

test(
  "a persisted Daraja response is reconciled without a second STK request",
  { skip: !testDatabaseUrl },
  async () => {
    const { query, payments } = await loadMpesaTestContext();
    const transactionId = randomUUID();
    const profileId = randomUUID();
    const outboxId = randomUUID();
    const suffix = randomUUID().replaceAll("-", "");
    const sequenceName = `mpesa_response_failure_${suffix}`;
    const functionName = `mpesa_response_failure_fn_${suffix}`;
    const triggerName = `mpesa_response_failure_trigger_${suffix}`;
    const originalFetch = globalThis.fetch;
    const previousEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY;
    let processRequestCount = 0;
    let queryRequestCount = 0;
    let triggerCreated = false;
    let profileCreated = false;

    process.env.SETTINGS_ENCRYPTION_KEY = `test-key-${suffix}`;

    try {
      const profile = payments.buildMpesaCredentialProfile({
        environment: "sandbox",
        transactionType: "CustomerPayBillOnline",
        baseUrl: "https://sandbox.safaricom.co.ke",
        consumerKey: `consumer-${suffix}`,
        consumerSecret: `secret-${suffix}`,
        passkey: `passkey-${suffix}`,
        shortcode: "174379",
        partyB: "174379",
        accountReference: "TEST",
        transactionDesc: "TEST DISPATCH",
      });

      await query(
        `INSERT INTO mpesa_credential_profiles (
           id, environment, transaction_type, base_url, shortcode, party_b,
           account_reference, transaction_desc, consumer_key_enc,
           consumer_secret_enc, passkey_enc
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          profileId,
          profile.environment,
          profile.transactionType,
          profile.baseUrl,
          profile.shortcode,
          profile.partyB,
          profile.accountReference,
          profile.transactionDesc,
          profile.consumerKey,
          profile.consumerSecret,
          profile.passkey,
        ]
      );
      profileCreated = true;

      await insertTransaction(query, {
        id: transactionId,
        credentialProfileId: profileId,
      });
      await query(
        `INSERT INTO mpesa_dispatch_outbox (id, transaction_id, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [
          outboxId,
          transactionId,
          JSON.stringify({
            phoneNumber: "254712345678",
            amount: 1,
          }),
        ]
      );

      await query(`CREATE SEQUENCE ${sequenceName}`);
      await query(
        `CREATE FUNCTION ${functionName}() RETURNS trigger
         LANGUAGE plpgsql
         AS $$
         BEGIN
           IF NEW.response IS DISTINCT FROM OLD.response
              AND nextval('public.${sequenceName}'::regclass) = 1 THEN
             RAISE EXCEPTION 'Injected response persistence failure';
           END IF;
           RETURN NEW;
         END;
         $$`
      );
      await query(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON mpesa_transactions
         FOR EACH ROW
         EXECUTE FUNCTION ${functionName}()`
      );
      triggerCreated = true;

      globalThis.fetch = async (url) => {
        const requestUrl = String(url);
        if (requestUrl.includes("/oauth/v1/generate")) {
          return new Response(
            JSON.stringify({
              access_token: `token-${suffix}`,
              expires_in: "3599",
            }),
            { status: 200 }
          );
        }
        if (requestUrl.includes("/mpesa/stkpush/v1/processrequest")) {
          processRequestCount += 1;
          return new Response(
            JSON.stringify({
              ResponseCode: "0",
              CheckoutRequestID: `CHECKOUT-${suffix}`,
              MerchantRequestID: `MERCHANT-${suffix}`,
            }),
            { status: 200 }
          );
        }
        if (requestUrl.includes("/mpesa/stkpushquery/v1/query")) {
          queryRequestCount += 1;
          return new Response(
            JSON.stringify({
              ResponseCode: "0",
              ResultCode: "2029",
              ResultDesc: "Still processing",
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected mocked Daraja request: ${requestUrl}`);
      };

      const dispatch = await payments.dispatchMpesaOutboxItem(outboxId);
      assert.equal(dispatch.status, "pending");
      assert.equal(dispatch.reconciliationRequired, true);

      await query(
        `UPDATE mpesa_dispatch_outbox
         SET next_retry_at = now() - interval '1 second'
         WHERE id = $1`,
        [outboxId]
      );
      const recovery = await payments.retryMpesaDispatchOutbox(5);

      assert.equal(processRequestCount, 1);
      assert.equal(queryRequestCount, 1);
      assert.equal(recovery[0]?.status, "retry");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousEncryptionKey === undefined) {
        delete process.env.SETTINGS_ENCRYPTION_KEY;
      } else {
        process.env.SETTINGS_ENCRYPTION_KEY = previousEncryptionKey;
      }
      if (triggerCreated) {
        await query(
          `DROP TRIGGER IF EXISTS ${triggerName} ON mpesa_transactions`
        );
      }
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
      await query(`DROP SEQUENCE IF EXISTS ${sequenceName}`);
      await deletePaymentFixtures(query, {
        transactionIds: [transactionId],
      });
      if (profileCreated) {
        await query(
          `ALTER TABLE mpesa_credential_profiles
           DISABLE TRIGGER mpesa_credential_profiles_immutable`
        );
        try {
          await query(
            "DELETE FROM mpesa_credential_profiles WHERE id = $1",
            [profileId]
          );
        } finally {
          await query(
            `ALTER TABLE mpesa_credential_profiles
             ENABLE TRIGGER mpesa_credential_profiles_immutable`
          );
        }
      }
    }

  }
);
