// Run: node --test tests/
// Covers the pure M-Pesa helpers — phone normalization and callback parsing.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgres://localhost:5432/drivehub_test";
const { normalizePhone, parseCallbackItems, parseC2bConfirmation, parsePullRows } = await import(
  "../src/routes/payments.js"
);

test("normalizePhone handles all Kenyan formats incl. new 01x numbers", () => {
  assert.equal(normalizePhone("0712345678"), "254712345678");
  assert.equal(normalizePhone("+254 712 345 678"), "254712345678");
  assert.equal(normalizePhone("712345678"), "254712345678");
  assert.equal(normalizePhone("254712345678"), "254712345678");
  assert.equal(normalizePhone("0110123456"), "254110123456"); // new 01x range
  assert.equal(normalizePhone(""), "");
});

test("parseCallbackItems flattens STK CallbackMetadata.Item", () => {
  const parsed = parseCallbackItems({
    CallbackMetadata: {
      Item: [
        { Name: "Amount", Value: 1.0 },
        { Name: "MpesaReceiptNumber", Value: "TGH2SX81KZ" },
        { Name: "PhoneNumber", Value: 254712345678 },
        { Name: "TransactionDate", Value: "20260823101530" },
      ],
    },
  });
  assert.equal(parsed.amount, 1);
  assert.equal(parsed.mpesaReceiptNumber, "TGH2SX81KZ");
  assert.equal(parsed.phoneNumber, "254712345678");
  assert.equal(parsed.transactionDate, "20260823101530");

  assert.deepEqual(parseCallbackItems({}), {}); // failed callbacks carry no metadata
});

test("secrets: AES-256-GCM roundtrip, wrong key and missing key fail closed", async () => {
  const { encryptSecret, decryptSecret } = await import("../src/utils/secrets.js");

  process.env.SETTINGS_ENCRYPTION_KEY = "test-master-key";
  const enc = encryptSecret("s3cret-passkey");
  assert.ok(enc?.startsWith("v1:"), "ciphertext is versioned");
  assert.ok(!enc.includes("s3cret-passkey"), "plaintext not stored verbatim");
  assert.equal(decryptSecret(enc), "s3cret-passkey");

  process.env.SETTINGS_ENCRYPTION_KEY = "different-key";
  assert.equal(decryptSecret(enc), null, "wrong key decrypts to nothing");

  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(encryptSecret("x"), null, "refuses to encrypt without key");
  assert.equal(decryptSecret(enc), null);
});

test("C2B confirmation parsing maps Daraja fields to cents", () => {
  const row = parseC2bConfirmation({
    TransID: "TGH2SX81KZ",
    TransactionType: "Pay Bill",
    TransTime: "20260823150700",
    TransAmount: "1500.00",
    BusinessShortCode: "174379",
    BillRefNumber: "ORDER 42",
    MSISDN: "254712345678",
    OrgAccountBalance: "50000.00",
  });
  assert.equal(row.transactionId, "TGH2SX81KZ");
  assert.equal(row.amountCents, 150000);
  assert.equal(row.msisdn, "254712345678");
  assert.equal(row.billRefNumber, "ORDER 42");
  assert.equal(parseC2bConfirmation({}).transactionId, "");
});

test("pull rows flatten nested arrays with loose key casing", () => {
  const rows = parsePullRows([
    [{ transID: "PULL1", TransAmount: "250", msisdn: "254700111222" }],
    [],
    [{ TRANSID: "PULL2", transamount: "99.50" }],
  ]);
  assert.equal(rows.length, 2); // empty group contributes nothing
  assert.equal(rows[0].transactionId, "PULL1");
  assert.equal(rows[0].amountCents, 25000);
  assert.equal(rows[1].transactionId, "PULL2");
  assert.equal(rows[1].amountCents, 9950);
  assert.deepEqual(parsePullRows(undefined), []);
});
