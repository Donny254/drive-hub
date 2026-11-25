import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { issueTicketsForRegistration } from "../utils/eventTickets.js";
import { sendEventTicketEmail } from "../email.js";
import { sendEventTicketMessage } from "../notifications.js";
import { decryptSecret } from "../utils/secrets.js";
import { getDarajaErrorCatalogue } from "../utils/darajaErrors.js";
import { createHash } from "node:crypto";
const router = Router();

const saveDarajaCallback = async ({
  callbackType,
  providerReference,
  payload,
}) => {
  const result = await query(
    `INSERT INTO mpesa_callback_inbox (
       callback_type,
       provider_reference,
       payload
     )
     VALUES ($1, $2, $3::jsonb)
     RETURNING id`,
    [
      callbackType,
      providerReference || null,
      JSON.stringify(payload || {}),
    ]
  );

  return result.rows[0]?.id;
};

const DARAJA_TIMEOUT_MS = 20_000;
const TOKEN_TTL_SKEW_SECONDS = 60;
// Safaricom retries missed callbacks; after this age we also probe Daraja
// directly (stkpushquery) whenever a client polls status, so a lost callback
// can never leave a paid order stuck in "pending".
const RECONCILE_MIN_AGE_MS = 15_000;
// Final STK-query failure codes: 1032 = cancelled by user, 1037 = timed out
// (customer unreachable). Anything else unknown stays pending — never fail a
// possibly-in-flight payment.
const FINAL_FAILED_RESULT_CODES = new Set(["1032", "1037"]);

const CALLBACK_IP_ALLOWLIST = (process.env.MPESA_CALLBACK_IP_ALLOWLIST || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (/mpesa/i.test(process.env.MPESA_CALLBACK_URL || "")) {
  console.warn(
    "MPESA_CALLBACK_URL contains the word 'mpesa' — Daraja has been known to reject callback URLs containing it. If callbacks never arrive in production, move this route to a neutral path."
  );
}

export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`;
  return digits;
};

const formatTimestampEAT = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}${byType.month}${byType.day}${byType.hour}${byType.minute}${byType.second}`;
};

const tokenCache = new Map();
const tokenInflight = new Map();

const getMpesaCredentials = async ({ environment: requestedEnvironment } = {}) => {
  const row = await loadSettingsRow().catch(() => null);

  const configuredEnvironment =
    row?.mpesa_environment ||
    (String(process.env.MPESA_ENV || "sandbox").toLowerCase() === "production"
      ? "production"
      : "sandbox");

  const environment =
    requestedEnvironment === "sandbox" || requestedEnvironment === "production"
      ? requestedEnvironment
      : configuredEnvironment;
  const prefix = environment === "production" ? "MPESA_PRODUCTION" : "MPESA_SANDBOX";
  const dbPrefix = environment === "production" ? "mpesa_production" : "mpesa_sandbox";

  const envValue = (suffix, legacyName = null) =>
    process.env[`${prefix}_${suffix}`] ||
    (legacyName ? process.env[legacyName] : null) ||
    null;

  const encryptedSecret = (column, suffix, legacyColumn = null, legacyName = null) => {
    const encrypted = row?.[column] || (legacyColumn ? row?.[legacyColumn] : null);
    return (
      (encrypted ? decryptSecret(encrypted) : null) ||
      envValue(suffix, legacyName)
    );
  };

  const shortcode =
    row?.[`${dbPrefix}_shortcode`] ||
    (environment === "sandbox" ? row?.mpesa_shortcode : null) ||
    envValue("SHORTCODE", environment === "sandbox" ? "MPESA_SHORTCODE" : null);

  const partyB =
    row?.[`${dbPrefix}_partyb`] ||
    (environment === "sandbox" ? row?.mpesa_partyb : null) ||
    envValue("PARTYB", environment === "sandbox" ? "MPESA_PARTYB" : null);

  return {
    environment,
    baseUrl:
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",

    consumerKey: encryptedSecret(
      `${dbPrefix}_consumer_key_enc`,
      "CONSUMER_KEY",
      environment === "sandbox" ? "mpesa_consumer_key_enc" : null,
      environment === "sandbox" ? "MPESA_CONSUMER_KEY" : null
    ),
    consumerSecret: encryptedSecret(
      `${dbPrefix}_consumer_secret_enc`,
      "CONSUMER_SECRET",
      environment === "sandbox" ? "mpesa_consumer_secret_enc" : null,
      environment === "sandbox" ? "MPESA_CONSUMER_SECRET" : null
    ),
    passkey: encryptedSecret(
      `${dbPrefix}_passkey_enc`,
      "PASSKEY",
      environment === "sandbox" ? "mpesa_passkey_enc" : null,
      environment === "sandbox" ? "MPESA_PASSKEY" : null
    ),
    shortcode,
    partyB,
    accountReference:
      row?.mpesa_account_reference || process.env.MPESA_ACCOUNT_REFERENCE || "WheelsnationKe Order",
    transactionDesc:
      row?.mpesa_transaction_desc || process.env.MPESA_TRANSACTION_DESC || "WheelsnationKe checkout",
  };
};

const darajaFetch = async (path, options = {}, baseUrl) => {
  if (!baseUrl) throw new Error("M-Pesa Daraja environment URL is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DARAJA_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const getAccessToken = async (creds, { forceRefresh = false } = {}) => {
  const { consumerKey, consumerSecret, environment, baseUrl } = creds;

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      `M-Pesa ${environment} credentials are incomplete: consumer key and consumer secret are required. Configure them for this environment in Admin Settings.`
    );
  }

  // Hash the environment and credentials: never store plaintext secrets as map keys.
  const cacheKey = createHash("sha256")
    .update(`${environment}\0${baseUrl}\0${consumerKey}\0${consumerSecret}`)
    .digest("hex");

  const cached = tokenCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAtMs > Date.now()) return cached.token;

  if (!forceRefresh && tokenInflight.has(cacheKey)) return tokenInflight.get(cacheKey);

  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const pending = (async () => {
    const response = await darajaFetch(
      "/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: { Authorization: `Basic ${basicAuth}` },
      },
      baseUrl
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to get M-Pesa ${environment} token (HTTP ${response.status}): ${text || "Daraja returned an empty response"}`
      );
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error(`M-Pesa ${environment} token response missing access_token`);
    }

    const ttlSeconds = Math.max(
      60,
      Number(data.expires_in || 3599) - TOKEN_TTL_SKEW_SECONDS
    );

    tokenCache.set(cacheKey, {
      token: data.access_token,
      expiresAtMs: Date.now() + ttlSeconds * 1000,
    });

    return data.access_token;
  })();

  tokenInflight.set(cacheKey, pending);

  try {
    return await pending;
  } finally {
    if (tokenInflight.get(cacheKey) === pending) {
      tokenInflight.delete(cacheKey);
    }
  }
};

const buildStkPayload = ({
  phoneNumber,
  amount,
  creds,
  callbackUrl,
}) => {
  if (!creds?.shortcode || !creds?.passkey) {
    throw new Error(
      "Missing M-Pesa shortcode/passkey. Configure them in admin settings."
    );
  }
  if (!callbackUrl) {
    throw new Error("M-Pesa callback URL is not configured.");
  }

  const timestamp = formatTimestampEAT();
  const password = Buffer.from(
    `${creds.shortcode}${creds.passkey}${timestamp}`
  ).toString("base64");

  return {
    BusinessShortCode: creds.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: creds.partyB || creds.shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: creds.accountReference,
    TransactionDesc: creds.transactionDesc,
  };
};

const prepareStkPayment = async ({ phoneNumber, amount }) => {
  const creds = await getMpesaCredentials();
  const callbackUrl = `${await callbackBaseUrl()}/stk/result`;

  // Validate the credentials and callback before creating payment records.
  buildStkPayload({
    phoneNumber,
    amount,
    creds,
    callbackUrl,
  });

  // Authenticate with the selected Daraja environment before creating records.
  // sendStkPush will reuse the cached token.
  await getAccessToken(creds);

  return creds;
};

// Flattens Body.stkCallback.CallbackMetadata.Item (or the identical structure
// returned by stkpushquery) into { amount, mpesaReceiptNumber, ... }.
export const parseCallbackItems = (callback) => {
  const items = callback?.CallbackMetadata?.Item;
  if (!Array.isArray(items)) return {};
  const byName = Object.fromEntries(items.map((item) => [item.Name, item.Value]));
  return {
    amount: byName.Amount != null ? Number(byName.Amount) : null,
    mpesaReceiptNumber: byName.MpesaReceiptNumber != null ? String(byName.MpesaReceiptNumber) : null,
    phoneNumber: byName.PhoneNumber != null ? String(byName.PhoneNumber) : null,
    transactionDate: byName.TransactionDate != null ? String(byName.TransactionDate) : null,
  };
};

const sendStkPush = async ({
  phoneNumber,
  amount,
  accountReference,
  transactionDesc,
  creds: suppliedCreds,
}) => {
  const creds = suppliedCreds || await getMpesaCredentials();
  const accessToken = await getAccessToken(creds);

  const callbackUrl = `${await callbackBaseUrl()}/stk/result`;

  const payload = buildStkPayload({
    phoneNumber,
    amount,
    creds,
    callbackUrl,
  });

  // Daraja caps these fields in production (12 and 13 chars).
  if (accountReference) {
    payload.AccountReference = String(accountReference).slice(0, 12);
  }

  if (transactionDesc) {
    payload.TransactionDesc = String(transactionDesc).slice(0, 13);
  }

  let response;

  try {
    response = await darajaFetch(
      "/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      creds.baseUrl
    );
  } catch (error) {
    return {
      _httpStatus: null,
      _transportError:
        error?.name === "AbortError"
          ? "Daraja STK Push request timed out; provider outcome is unknown."
          : String(error?.message || "Network error while contacting Daraja"),
      _outcomeUnknown: true,
    };
  }

  const responseText = await response.text().catch(() => "");
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {
      _unparsedResponse: responseText.slice(0, 4000),
    };
  }

  return {
    ...data,
    _httpStatus: response.status,
    _httpOk: response.ok,
    ...( !responseText ? { _emptyResponse: true } : {} ),
    ...( !response.ok ? { _providerHttpError: true } : {} ),
  };
};

const recordStkResponse = async (transactionId, responseData) => {
  const responseCode =
    responseData?.ResponseCode ??
    responseData?.responseCode ??
    null;

  const normalizedCode =
    responseCode == null
      ? null
      : String(responseCode).trim();

  const httpStatus = Number(responseData?._httpStatus);
  const hasHttpStatus = Number.isInteger(httpStatus) && httpStatus > 0;

  const explicitRejection =
    normalizedCode !== null &&
    normalizedCode !== "" &&
    normalizedCode !== "0" &&
    (!hasHttpStatus || httpStatus < 500);

  // Missing/malformed responses and HTTP 5xx responses are ambiguous.
  // Never allow them to release the payment as a definite failure.
  const status = explicitRejection ? "failed" : "pending";

  await query(
    `UPDATE mpesa_transactions
     SET checkout_request_id = COALESCE($1, checkout_request_id),
         merchant_request_id = COALESCE($2, merchant_request_id),
         response = COALESCE(response, '{}'::jsonb)
           || jsonb_build_object('stk_push', $3::jsonb),
         status = $4
     WHERE id = $5`,
    [
      responseData?.CheckoutRequestID || null,
      responseData?.MerchantRequestID || null,
      JSON.stringify(responseData || {}),
      status,
      transactionId,
    ]
  );

  if (status === "pending" && normalizedCode !== "0") {
    console.warn(
      `M-Pesa STK Push outcome is unresolved for transaction ${transactionId}. ` +
      `HTTP status: ${hasHttpStatus ? httpStatus : "unknown"}; ` +
      `Response code: ${normalizedCode || "missing"}.`
    );
  }

  return status;
};

// Probes Daraja for a transaction whose callback may have been lost.
// Returns { status: 'paid'|'failed'|null, raw, amount, mpesaReceiptNumber } —
// status null means "still in flight / unknown", leave it pending.

export const queryCheckoutStatus = async (
  checkoutRequestId,
  environment = null,
) => {
  if (!checkoutRequestId) return null;

  const creds = await getMpesaCredentials({ environment });
  if (!creds.shortcode || !creds.passkey) return null;

  const timestamp = formatTimestampEAT();
  const accessToken = await getAccessToken(creds);

  const response = await darajaFetch(
    "/mpesa/stkpushquery/v1/query",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: creds.shortcode,
        Password: Buffer.from(
          `${creds.shortcode}${creds.passkey}${timestamp}`,
        ).toString("base64"),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    },
    creds.baseUrl,
  );

  const data = await response.json().catch(() => ({}));

  // Preserve both layers independently:
  // ResultCode = transaction/query result
  // ResponseCode = request/API response where present
  const resultCode =
    data?.ResultCode != null ? String(data.ResultCode).trim() : null;

  const responseCode =
    data?.ResponseCode != null
      ? String(data.ResponseCode).trim()
      : data?.responseCode != null
        ? String(data.responseCode).trim()
        : null;

  const resultDesc = data?.ResultDesc != null ? String(data.ResultDesc) : null;

  const responseDescription =
    data?.ResponseDescription != null
      ? String(data.ResponseDescription)
      : data?.ResponseMessage != null
        ? String(data.ResponseMessage)
        : null;

  // A non-zero request-level response is not evidence of a
  // transaction failure. Leave it unresolved.
  const requestRejected = responseCode != null && responseCode !== "0";

  let status = null;

  if (!requestRejected && resultCode === "0") {
    // Candidate success only. finalizeTx still requires receipt
    // and amount validation before settlement.
    status = "paid";
  } else if (
    !requestRejected &&
    resultCode != null &&
    FINAL_FAILED_RESULT_CODES.has(resultCode)
  ) {
    status = "failed";
  }

  return {
    status,
    resultCode,
    responseCode,
    resultDesc,
    responseDescription,
    requestRejected,
    raw: data,
    ...parseCallbackItems(data),
  };
};


// Applies a final result to a pending transaction exactly once (the
// `status = 'pending'` guard makes duplicate callbacks / poll races a no-op)
// and cascades to the order/booking/registration it paid for.
export const settleMpesaTransaction = async ({
  checkoutRequestId,
  status,
  metadata = {},
  rawPayload,
  source = "callback",
}) => {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `UPDATE mpesa_transactions
       SET status = $1,
           response = COALESCE(response, '{}'::jsonb)
             || jsonb_build_object($2::text, $3::jsonb),
           result_code = $4,
           mpesa_receipt_number = COALESCE($5, mpesa_receipt_number)
       WHERE checkout_request_id = $6 AND status = 'pending'
       RETURNING order_id, booking_id, event_registration_id`,
      [
        status,
        source,
        JSON.stringify(rawPayload || {}),
        rawPayload?.ResultCode != null ? String(rawPayload.ResultCode) : null,
        metadata.mpesaReceiptNumber || null,
        checkoutRequestId,
      ]
    );

    if (txResult.rowCount === 0) {
      return { settled: false };
    }

    const {
      order_id: orderId,
      booking_id: bookingId,
      event_registration_id: eventRegistrationId,
    } = txResult.rows[0];

    if (orderId) {
      const orderSelect = await client.query(
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId]
      );

      if (orderSelect.rowCount > 0) {
        const currentStatus = orderSelect.rows[0].status;
        const paidAt = status === "paid" ? new Date().toISOString() : null;

        if (status === "paid" && currentStatus !== "paid") {
          const insufficientResult = await client.query(
            `SELECT p.id, p.name, p.stock, SUM(oi.quantity) AS required_quantity
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1
             GROUP BY p.id, p.name, p.stock
             HAVING SUM(oi.quantity) > p.stock`,
            [orderId]
          );

          if (insufficientResult.rowCount > 0) {
            await client.query(
              `UPDATE orders
               SET status = 'cancelled', payment_status = 'failed', paid_at = NULL
               WHERE id = $1`,
              [orderId]
            );
          } else {
            await client.query(
              `UPDATE orders
               SET status = 'paid', payment_status = 'paid', paid_at = $1
               WHERE id = $2`,
              [paidAt, orderId]
            );

            await client.query(
              `UPDATE products
               SET stock = stock - oi.quantity
               FROM order_items oi
               WHERE oi.order_id = $1
                 AND products.id = oi.product_id
                 AND oi.product_id IS NOT NULL`,
              [orderId]
            );
          }
        } else if (status !== "paid" && currentStatus !== "cancelled") {
          await client.query(
            "UPDATE orders SET status = $1, payment_status = $2 WHERE id = $3",
            [status === "failed" ? "cancelled" : status, status, orderId]
          );
        }
      }
    }

    if (bookingId) {
      const paymentStatus = status === "paid" ? "paid" : "failed";
      const paidAt = status === "paid" ? new Date().toISOString() : null;
      await client.query(
        "UPDATE bookings SET payment_status = $1, paid_at = $2 WHERE id = $3",
        [paymentStatus, paidAt, bookingId]
      );
    }

    if (eventRegistrationId) {
      const paymentStatus = status === "paid" ? "paid" : "failed";
      const paidAt = status === "paid" ? new Date().toISOString() : null;
      const registrationStatus = status === "paid" ? "confirmed" : "pending";
      await client.query(
        `UPDATE event_registrations
         SET payment_status = $1,
             paid_at = $2,
             status = CASE WHEN status = 'cancelled' THEN status ELSE $3 END
         WHERE id = $4`,
        [paymentStatus, paidAt, registrationStatus, eventRegistrationId]
      );
      if (status === "paid") {
        await notifyPaidRegistration(eventRegistrationId);
      }
    }

    return { settled: true };
  });
};

// Verifies the paid amount before settling; on mismatch leaves the
// transaction pending for manual admin review instead of auto-fulfilling.
const finalizeTx = async (txRow, result, source = "callback") => {
  const expectedKes = Math.round(Number(txRow.amount_cents || 0) / 100);
  const receipt = String(result.mpesaReceiptNumber || "").trim();
  const actualAmount = result.amount;
  const verificationProblems = [];

  if (result.status === "paid" && !receipt) {
    verificationProblems.push("Missing M-Pesa receipt number");
  }
  if (result.status === "paid" && actualAmount == null) {
    verificationProblems.push("Missing payment amount");
  }
  if (
    result.status === "paid" &&
    actualAmount != null &&
    Number(actualAmount) !== expectedKes
  ) {
    verificationProblems.push(
      `Amount mismatch: expected KES ${expectedKes}, received KES ${actualAmount}`
    );
  }

  if (verificationProblems.length > 0) {
    const errorMessage = verificationProblems.join("; ");
    console.warn(
      `M-Pesa verification failed for transaction ${txRow.id}: ${errorMessage}`
    );
    await query(
      `UPDATE mpesa_transactions
       SET response = COALESCE(response, '{}'::jsonb)
         || jsonb_build_object($1::text, $2::jsonb),
           result_code = COALESCE($3, result_code)
       WHERE id = $4
         AND status = 'pending'`,
      [
        source,
        JSON.stringify({
          raw: result.raw || {},
          verificationProblems,
        }),
        result.resultCode != null
          ? String(result.resultCode)
          : result.raw?.ResultCode != null
            ? String(result.raw.ResultCode)
            : null,
        txRow.id,
      ]
    );
    return {
      settled: false,
      verificationFailed: true,
      verificationProblems,
    };
  }

  return settleMpesaTransaction({
    checkoutRequestId: txRow.checkout_request_id,
    status: result.status,
    metadata: result,
    rawPayload: result.raw,
    source,
  });
};

// Called by the status endpoints when a polled transaction is still pending:
// asks Daraja directly so a lost callback can't leave money taken with nothing
// delivered.
const reconcilePendingTransaction = async (transaction) => {
  if (!transaction?.checkout_request_id || transaction.status !== "pending") return transaction;
  if (Date.now() - new Date(transaction.created_at).getTime() < RECONCILE_MIN_AGE_MS) {
    return transaction;
  }
  try {
    const result = await queryCheckoutStatus(
      transaction.checkout_request_id,
      transaction.mpesa_environment || null
    );
    if (!result?.status) return transaction;
    await finalizeTx(transaction, result, "reconciliation");
    const refreshed = await query("SELECT * FROM mpesa_transactions WHERE id = $1", [
      transaction.id,
    ]);
    return refreshed.rowCount > 0 ? refreshed.rows[0] : transaction;
  } catch (error) {
    console.warn("M-Pesa reconciliation failed:", error.message);
    return transaction;
  }
};

// Status-endpoint wrapper: loads the latest tx from a query result and
// reconciles it with Daraja if it's still pending.
const reconcileable = async (txResult) => {
  const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
  return transaction ? reconcilePendingTransaction(transaction) : null;
};

// ── C2B / Pull Transactions ────────────────────────────────────────────────
// Manual paybill payments (customer pays from their M-Pesa menu) never touch
// STK. Two ways to see them: registered confirmation webhooks, or polling the
// Pull Transactions API. Both land in mpesa_c2b_transactions, deduped by
// Safaricom's TransID.

export const parseC2bConfirmation = (body) => ({
  transactionId: body?.TransID != null ? String(body.TransID) : "",
  transactionType: body?.TransactionType || null,
  transTime: body?.TransTime != null ? String(body.TransTime) : null,
  amountCents: body?.TransAmount != null ? Math.round(Number(body.TransAmount) * 100) : null,
  businessShortCode: body?.BusinessShortCode != null ? String(body.BusinessShortCode) : null,
  billRefNumber: body?.BillRefNumber || null,
  msisdn: body?.MSISDN != null ? String(body.MSISDN) : null,
  orgAccountBalance: body?.OrgAccountBalance != null ? String(body.OrgAccountBalance) : null,
});

// Pull query returns rows as nested arrays of loose key/value objects with
// inconsistent casing; flatten them into the same shape as C2B confirmations.
export const parsePullRows = (response) => {
  const rows = [];
  const visited = new Set();

  const normalizeKey = (value) =>
    String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

  const readFields = (row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return {};

    const fields = {};
    for (const [key, value] of Object.entries(row)) {
      fields[normalizeKey(key)] = value;
    }

    if (Array.isArray(row.Item)) {
      for (const item of row.Item) {
        if (item?.Name != null) {
          fields[normalizeKey(item.Name)] = item.Value;
        }
      }
    }

    return fields;
  };

  const get = (fields, ...names) => {
    for (const name of names) {
      const value = fields[normalizeKey(name)];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  };

  const visit = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const fields = readFields(value);
    const transactionId = get(
      fields,
      "TransID",
      "TransactionID",
      "TransactionId",
      "ReceiptNumber"
    );

    if (transactionId != null) {
      const amountValue = get(fields, "TransAmount", "TransactionAmount", "Amount");
      const amount = amountValue == null ? null : Number(amountValue);

      rows.push({
        transactionId: String(transactionId).trim(),
        transactionType: get(fields, "TransactionType"),
        transTime: get(fields, "TransTime", "TransactionTime"),
        amountCents:
          amount != null && Number.isFinite(amount)
            ? Math.round(amount * 100)
            : null,
        businessShortCode: get(fields, "BusinessShortCode", "ShortCode"),
        billRefNumber: get(fields, "BillRefNumber", "AccountReference"),
        msisdn: get(fields, "MSISDN", "MSISDNNumber", "PhoneNumber"),
        orgAccountBalance: get(
          fields,
          "OrgAccountBalance",
          "OrganizationAccountBalance"
        ),
      });
      return;
    }

    for (const key of [
      "Response",
      "Transaction",
      "Transactions",
      "Result",
      "Results",
      "Data",
      "Body",
      "Records",
      "Items",
    ]) {
      if (value[key] != null) visit(value[key]);
    }
  };

  visit(response);

  const unique = new Map();
  for (const row of rows) {
    if (row.transactionId) unique.set(row.transactionId, row);
  }

  return [...unique.values()];
};

const recordC2bTransactions = async (rows, source) => {
  let inserted = 0;
  for (const row of rows) {
    if (!row.transactionId) continue;
    const result = await query(
      `INSERT INTO mpesa_c2b_transactions
         (trans_id, transaction_type, trans_time, amount_cents, business_short_code,
          bill_ref_number, msisdn, org_account_balance, source, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (trans_id) DO NOTHING`,
      [
        row.transactionId,
        row.transactionType,
        row.transTime,
        row.amountCents,
        row.businessShortCode,
        row.billRefNumber,
        row.msisdn,
        row.orgAccountBalance,
        source,
        JSON.stringify(row),
      ]
    );
    inserted += result.rowCount || 0;
  }
  return inserted;
};

const processStoredDarajaCallback = async (inbox) => {
  const payload = inbox.payload || {};

  if (inbox.callback_type === "pull") {
    let rows = parsePullRows(payload);
    if (rows.length === 0) {
      const single = parseC2bConfirmation(payload);
      if (single.transactionId) rows = [single];
    }
    if (rows.length > 0) {
      await recordC2bTransactions(rows, "pull_callback");
    }
    return {
      processed: true,
      message:
        rows.length > 0
          ? "Pull callback transactions recorded."
          : "Pull callback stored; no transaction rows recognized.",
    };
  }

  if (inbox.callback_type === "c2b") {
    const row = parseC2bConfirmation(payload);

    if (!row.transactionId) {
      throw new Error("C2B callback has no TransID.");
    }

    await recordC2bTransactions([row], "c2b");
    return { processed: true, message: "C2B transaction recorded." };
  }

  if (inbox.callback_type === "stk") {
    const callback = payload?.stkCallback || payload;
    const checkoutRequestId = callback?.CheckoutRequestID;

    if (!checkoutRequestId) {
      throw new Error("STK callback has no CheckoutRequestID.");
    }

    const resultCode = String(callback.ResultCode);
    const metadata = parseCallbackItems(callback);
    const txResult = await query(
      `SELECT *
       FROM mpesa_transactions
       WHERE checkout_request_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [checkoutRequestId]
    );

    if (txResult.rowCount === 0) {
      throw new Error(
        `No payment transaction matches CheckoutRequestID ${checkoutRequestId}`
      );
    }

    const tx = txResult.rows[0];
    if (tx.status !== "pending") {
      return {
        processed: true,
        message: `Payment already ${tx.status}.`,
      };
    }

    if (resultCode === "0") {
      const result = await finalizeTx(
        tx,
        {
          status: "paid",
          resultCode,
          amount: metadata.amount,
          mpesaReceiptNumber: metadata.mpesaReceiptNumber,
          phoneNumber: metadata.phoneNumber,
          transactionDate: metadata.transactionDate,
          raw: callback,
        },
        "callback"
      );

      if (result?.verificationFailed) {
        throw new Error(result.verificationProblems.join("; "));
      }

      if (!result?.settled) {
        const refreshed = await query(
          `SELECT status
           FROM mpesa_transactions
           WHERE id = $1`,
          [tx.id]
        );

        if (refreshed.rows[0]?.status !== "paid") {
          throw new Error(
            "Payment settlement did not complete; retry or reconcile."
          );
        }
      }
    } else {
      await settleMpesaTransaction({
        checkoutRequestId,
        status: "failed",
        metadata,
        rawPayload: callback,
        source: "callback",
      });
    }

    return { processed: true, message: "STK callback processed." };
  }

  throw new Error(`Unsupported callback type: ${inbox.callback_type}`);
};

const DEFAULT_MPESA_CALLBACK_DOMAIN = "https://wheelsnation.co.ke";

class InvalidCallbackDomainError extends Error {}

const normalizeCallbackDomain = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    throw new InvalidCallbackDomainError("Enter a callback domain.");
  }

  let url;

  try {
    url = new URL(
      raw.includes("://") ? raw : `https://${raw}`
    );
  } catch {
    throw new InvalidCallbackDomainError("Enter a valid domain.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local")
  ) {
    throw new InvalidCallbackDomainError(
      "Callback domain must be a public HTTPS domain."
    );
  }

  return url.origin;
};

const getCallbackDomain = async () => {
  const settings = await loadSettingsRow();

  if (settings?.mpesa_callback_domain) {
    return normalizeCallbackDomain(settings.mpesa_callback_domain);
  }

  const candidates = [
    process.env.MPESA_CALLBACK_BASE_URL,
    process.env.MPESA_CALLBACK_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    DEFAULT_MPESA_CALLBACK_DOMAIN,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return normalizeCallbackDomain(candidate);
    } catch (error) {
      if (!(error instanceof InvalidCallbackDomainError)) throw error;
    }
  }

  return DEFAULT_MPESA_CALLBACK_DOMAIN;
};

const callbackBaseUrl = async () => {
  const domain = await getCallbackDomain();
  return `${domain}/api/payments`;
};

const buildCallbackConfig = async () => {
  const domain = await getCallbackDomain();
  const baseUrl = `${domain}/api/payments`;

  return {
    configured: true,
    domain,
    baseUrl,
    callbacks: {
      stk: `${baseUrl}/stk/result`,
      c2bConfirmation: `${baseUrl}/c2b/confirmation`,
      c2bValidation: `${baseUrl}/c2b/validation`,
      pullResult: `${baseUrl}/pull/result`,
    },
    registration: {
      stk: "sent_with_each_stk_push",
      c2b: "manual_registration_required",
      pull: "registered_with_nominated_number",
    },
  };
};

router.get(
  "/mpesa/admin/callback-config",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json(await buildCallbackConfig());
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/mpesa/admin/callback-config",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    let domain;

    try {
      domain = normalizeCallbackDomain(req.body?.domain);
    } catch (error) {
      return res.status(400).json({
        error: error.message || "Invalid callback domain.",
      });
    }

    try {
      await query(
        `INSERT INTO site_settings (
           id,
           mpesa_callback_domain
         )
         VALUES (true, $1)
         ON CONFLICT (id)
         DO UPDATE SET
           mpesa_callback_domain = EXCLUDED.mpesa_callback_domain,
           updated_at = now()`,
        [domain]
      );

      res.json({
        ok: true,
        message: "M-Pesa callback domain saved.",
        ...(await buildCallbackConfig()),
      });
    } catch (error) {
      next(error);
    }
  }
);

const darajaAdminPost = async (path, body) => {
  const creds = await getMpesaCredentials();
  const accessToken = await getAccessToken(creds);

  const response = await darajaFetch(
    path,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    creds.baseUrl
  );

  return response.json().catch(() => ({}));
};

router.post("/mpesa/test-connection", requireAuth, requireRole("admin"), async (req, res) => {
  let environment = null;

  try {
    const requestedEnvironment = req.body?.environment;

    if (
      requestedEnvironment !== undefined &&
      requestedEnvironment !== null &&
      !["sandbox", "production"].includes(requestedEnvironment)
    ) {
      return res.status(400).json({ error: "Invalid M-Pesa environment." });
    }

    const creds = await getMpesaCredentials({
      environment: requestedEnvironment || undefined,
    });
    environment = creds.environment;

    // Use non-empty unsaved credentials from the selected environment.
    // Blank fields deliberately fall back to the currently saved credentials.
    const overrides = req.body?.credentials?.[environment] || {};
    const consumerKey =
      typeof overrides.consumerKey === "string" && overrides.consumerKey.trim()
        ? overrides.consumerKey.trim()
        : creds.consumerKey;
    const consumerSecret =
      typeof overrides.consumerSecret === "string" && overrides.consumerSecret.trim()
        ? overrides.consumerSecret.trim()
        : creds.consumerSecret;

    if (!consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        environment,
        error: `The ${environment} consumer key and consumer secret are not configured.`,
      });
    }

    await getAccessToken(
      { ...creds, consumerKey, consumerSecret },
      { forceRefresh: true }
    );

    return res.json({
      success: true,
      environment,
      message: `Daraja OAuth authentication succeeded for ${environment}.`,
    });
  } catch (error) {
    // Never return provider response bodies, tokens, credentials, or raw errors.
    const statusMatch = String(error?.message || "").match(/\bHTTP\s+(\d{3})\b/i);
    const providerStatus = statusMatch ? Number(statusMatch[1]) : null;

    if (providerStatus) {
      return res.status(502).json({
        success: false,
        environment,
        error: `Daraja rejected the OAuth request (HTTP ${providerStatus}). Check the credentials and selected environment.`,
      });
    }

    return res.status(502).json({
      success: false,
      environment,
      error: "Could not complete the Daraja OAuth request. Check network access and try again.",
    });
  }
});

router.post("/mpesa/register-url", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const creds = await getMpesaCredentials();
    if (!creds.shortcode) {
      return res.status(400).json({ error: "M-Pesa shortcode not configured" });
    }
    const base = await callbackBaseUrl();
    if (!base || !/^https:\/\//.test(base)) {
      return res.status(400).json({ error: "Set MPESA_CALLBACK_BASE_URL (https) to register webhook URLs" });
    }

    const responseData = await darajaAdminPost("/mpesa/c2b/v1/registerurl", {
      ShortCode: creds.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: `${base}/c2b/confirmation`,
      ValidationURL: `${base}/c2b/validation`,
    });

    const responseCode = responseData.ResponseCode ?? responseData.responseCode;
    if (responseCode !== "0" && responseCode !== 0) {
      return res.status(400).json({
        error: responseData.ResponseDescription || responseData.errorMessage || "Daraja rejected the registration",
        response: responseData,
      });
    }
    res.json({ ok: true, response: responseData });
  } catch (error) {
    next(error);
  }
});

router.post("/mpesa/pull/register", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const creds = await getMpesaCredentials();

    if (!creds.shortcode) {
      return res.status(400).json({
        error: "M-Pesa shortcode not configured",
      });
    }

    const nominatedNumber = normalizePhone(req.body.nominatedNumber);

    if (!/^254\d{9}$/.test(nominatedNumber)) {
      return res.status(400).json({
        error: "nominatedNumber must be a valid Kenyan mobile number",
      });
    }

    const base = await callbackBaseUrl();

    if (!base || !/^https:\/\//i.test(base)) {
      return res.status(400).json({
        error: "Set MPESA_CALLBACK_BASE_URL (https) to register pull callbacks",
      });
    }

    const responseData = await darajaAdminPost(
      "/pulltransactions/v1/register",
      {
        ShortCode: creds.shortcode,
        RequestType: "Pull",
        NominatedNumber: nominatedNumber,
        CallBackURL: `${base}/pull/result`,
      }
    );

    const responseCode = String(
      responseData?.ResponseStatus ??
      responseData?.["Response Status"] ??
      responseData?.ResponseCode ??
      ""
    );

    const responseMessage =
      responseData?.ResponseDescription ??
      responseData?.["Response Description"] ??
      responseData?.ResponseMessage ??
      responseData?.errorMessage ??
      null;

    // 1000 = registered; 1001 = already registered.
    if (!["1000", "1001"].includes(responseCode)) {
      return res.status(502).json({
        error: responseMessage || "Safaricom did not confirm Pull registration",
        responseCode: responseCode || null,
        response: responseData,
      });
    }

    res.json({
      ok: true,
      alreadyRegistered: responseCode === "1001",
      responseCode,
      responseMessage,
      response: responseData,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/mpesa/pull/query", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const creds = await getMpesaCredentials();

    if (!creds.shortcode) {
      return res.status(400).json({
        error: "M-Pesa shortcode not configured",
      });
    }

    const startDate = String(req.body.startDate || "");
    const endDate = String(req.body.endDate || startDate);

    const isValidDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));

      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      );
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: "Both startDate and endDate must be valid dates in YYYY-MM-DD format",
      });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.000Z`);

    if (end < start) {
      return res.status(400).json({
        error: "endDate cannot be earlier than startDate",
      });
    }

    const rangeHours = (end.getTime() - start.getTime()) / 3_600_000;

    if (rangeHours > 48) {
      return res.status(400).json({
        error: "Pull Transactions supports a maximum query window of 48 hours",
      });
    }

    const rawOffset = req.body.offsetValue ?? "0";
    const offsetValue = String(rawOffset);

    if (!/^\d+$/.test(offsetValue)) {
      return res.status(400).json({
        error: "offsetValue must be a non-negative integer",
      });
    }

    const data = await darajaAdminPost("/pulltransactions/v1/query", {
      ShortCode: creds.shortcode,
      StartDate: `${startDate} 00:00:00`,
      EndDate: `${endDate} 23:59:59`,
      OffSetValue: offsetValue,
    });

    const responseCode = String(
      data?.ResponseCode ??
      data?.ResponseStatus ??
      data?.["Response Status"] ??
      ""
    );

    const responseMessage =
      data?.ResponseMessage ??
      data?.["Response Message"] ??
      data?.ResponseDescription ??
      data?.["Response Description"] ??
      null;

    // 1000 = transactions fetched; 1001 = no transactions in this period.
    if (!["1000", "1001"].includes(responseCode)) {
      return res.status(502).json({
        error: responseMessage || "Safaricom rejected the Pull Transactions query",
        responseCode: responseCode || null,
        response: data,
      });
    }

    const rows = parsePullRows(data);

    if (responseCode === "1000" && rows.length === 0) {
      console.error("Daraja Pull query returned success but no parseable transactions", {
        responseKeys: Object.keys(data || {}),
      });

      return res.status(502).json({
        error:
          "Daraja reported transactions, but the response contained no parseable transaction rows. Inspect the provider response before treating this query as empty.",
        responseCode,
        response: data,
      });
    }

    const stored = rows.length > 0
      ? await recordC2bTransactions(rows, "pull")
      : 0;

    res.json({
      responseCode,
      responseMessage,
      fetched: rows.length,
      newTransactions: stored,
      transactions: rows,
      providerResponse: data,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mpesa/c2b-transactions", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const result = await query(
      `SELECT * FROM mpesa_c2b_transactions ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        transId: row.trans_id,
        transactionType: row.transaction_type,
        transTime: row.trans_time,
        amountCents: row.amount_cents,
        businessShortCode: row.business_short_code,
        billRefNumber: row.bill_ref_number,
        msisdn: row.msisdn,
        orgAccountBalance: row.org_account_balance,
        source: row.source,
        createdAt: row.created_at,
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Admin: list STK transactions for monitoring and troubleshooting.
router.get(
  "/mpesa/admin/transactions",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 500)
        : 100;

      const result = await query(
        `SELECT
           id,
           phone_number,
           amount_cents,
           checkout_request_id,
           merchant_request_id,
           status,
           mpesa_environment,
           result_code,
           mpesa_receipt_number,
           response,
           created_at,
           updated_at,
           order_id,
           booking_id,
           event_registration_id
         FROM mpesa_transactions
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );

      res.json({
        transactions: result.rows,
        count: result.rowCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: initiate a standalone STK Push for diagnostics or manual collection.
// This does not create an order, booking, or event registration.
router.post(
  "/mpesa/admin/stk-push",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    let transactionId = null;

    try {
      const phoneNumber = normalizePhone(req.body?.phoneNumber);
      const amount = Number(req.body?.amount);

      if (!/^254\d{9}$/.test(phoneNumber)) {
        return res.status(400).json({
          error: "Enter a valid Kenyan phone number.",
        });
      }

      if (!Number.isSafeInteger(amount) || amount < 1) {
        return res.status(400).json({
          error: "Amount must be a positive whole number in KES.",
        });
      }

      const creds = await getMpesaCredentials();

      // Record the attempt before contacting Daraja. This ensures failed
      // network requests are also visible in the admin transaction history.
      const inserted = await query(
        `INSERT INTO mpesa_transactions (
           phone_number,
           amount_cents,
           status,
           mpesa_environment
         )
         VALUES ($1, $2, 'pending', $3)
         RETURNING id`,
        [phoneNumber, amount * 100, creds.environment]
      );

      transactionId = inserted.rows[0].id;

      try {
        const responseData = await sendStkPush({
          phoneNumber,
          amount,
          creds,
          accountReference: "ADMIN TEST",
          transactionDesc: "Admin STK test",
        });

        const status = await recordStkResponse(
          transactionId,
          responseData
        );

        const saved = await query(
          `SELECT *
           FROM mpesa_transactions
           WHERE id = $1`,
          [transactionId]
        );

        return res.status(status === "failed" ? 502 : 200).json({
          transaction: saved.rows[0],
          response: responseData,
          error:
            status === "failed"
              ? responseData.ResponseDescription ||
                responseData.errorMessage ||
                "Safaricom rejected the STK Push request."
              : null,
        });
      } catch (providerError) {
        const safeMessage = String(
          providerError?.message || "STK Push request failed."
        ).slice(0, 1000);

        await query(
          `UPDATE mpesa_transactions
           SET status = 'failed',
               response = COALESCE(response, '{}'::jsonb)
                 || jsonb_build_object('stk_push', $1::jsonb)
           WHERE id = $2`,
          [
            JSON.stringify({
              error: safeMessage,
              stage: "stk_push_request",
            }),
            transactionId,
          ]
        );

        const saved = await query(
          `SELECT *
           FROM mpesa_transactions
           WHERE id = $1`,
          [transactionId]
        );

        return res.status(502).json({
          error: safeMessage,
          transaction: saved.rows[0] || null,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

const computeDays = (startDate, endDate) => {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
};

const computeCartTotal = (items) =>
  items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

const loadSettingsRow = async () => {
  const result = await query("SELECT * FROM site_settings WHERE id = true");
  return result.rowCount > 0 ? result.rows[0] : null;
};

const getCryptoDetails = async () => {
  const settings = await loadSettingsRow().catch(() => null);
  return {
    asset: settings?.crypto_currency || process.env.CRYPTO_CURRENCY || "USDT",
    network: settings?.crypto_network || process.env.CRYPTO_NETWORK || null,
    walletAddress: settings?.crypto_wallet_address || process.env.CRYPTO_WALLET_ADDRESS || null,
    networkEvm: settings?.crypto_network_evm || process.env.CRYPTO_NETWORK_EVM || null,
    walletAddressEvm: settings?.crypto_wallet_address_evm || process.env.CRYPTO_WALLET_ADDRESS_EVM || null,
    instructions:
      settings?.crypto_instructions ||
      process.env.CRYPTO_INSTRUCTIONS ||
      "Send payment, then submit the transaction hash for manual confirmation.",
  };
};

const requireCryptoConfig = async (res) => {
  const details = await getCryptoDetails();
  if (!details.walletAddress) {
    res.status(400).json({ error: "Crypto payment is not configured yet" });
    return null;
  }
  return details;
};

const normalizeCryptoPayload = (body, cryptoDetails) => {
  const asset = String(body.asset || cryptoDetails.asset || "USDT").trim().toUpperCase();
  const network = String(body.network || cryptoDetails.network || "").trim() || null;
  const payerWallet = String(body.payerWallet || "").trim() || null;
  const transactionHash = String(body.transactionHash || "").trim();
  const proofImageUrl = String(body.proofImageUrl || "").trim() || null;
  return {
    asset,
    network,
    payerWallet,
    transactionHash,
    proofImageUrl,
    walletAddress: cryptoDetails.walletAddress,
  };
};

const ensureCryptoProof = (payload) => {
  const hashError = validateCryptoHash(payload.network, payload.transactionHash);
  if (hashError) return hashError;
  if (!payload.proofImageUrl) {
    return "Payment proof image is required";
  }
  return null;
};

const ensureUniqueCryptoHash = async (transactionHash) => {
  const normalizedHash = String(transactionHash || "").trim().toLowerCase();
  if (!normalizedHash) return "Transaction hash is required";
  const result = await query(
    `SELECT id
     FROM crypto_transactions
     WHERE lower(transaction_hash) = $1
       AND status <> 'cancelled'
     LIMIT 1`,
    [normalizedHash]
  );
  return result.rowCount > 0 ? "This transaction hash has already been submitted" : null;
};

const EVM_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const TRON_HASH_RE = /^[0-9a-fA-F]{64}$/;
const SOL_HASH_RE = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/;

const validateCryptoHash = (network, transactionHash) => {
  const hash = String(transactionHash || "").trim();
  if (!hash) return "Transaction hash is required";
  if (hash.length < 20 || hash.length > 200) return "Transaction hash length is invalid";

  const net = String(network || "").trim().toLowerCase();
  if (/^(eth|ethereum|erc20|erc-20|bsc|bnb|bep20|binance smart chain|polygon|matic|poly|arb|arbitrum|base|avax|avalanche|optimism|op|celo|fantom|ftm)$/.test(net)) {
    if (!EVM_HASH_RE.test(hash)) return "Transaction hash must be a 0x-prefixed 66-character hex string for this network";
  } else if (/^(tron|trc20)$/.test(net)) {
    if (!TRON_HASH_RE.test(hash)) return "Transaction hash must be a 64-character hex string for Tron";
  } else if (/^(sol|solana)$/.test(net)) {
    if (!SOL_HASH_RE.test(hash)) return "Transaction hash must be a valid Solana base58 signature";
  }

  return null;
};

const latestCryptoSelect = `SELECT *
  FROM crypto_transactions
  WHERE %COLUMN% = $1
  ORDER BY created_at DESC
  LIMIT 1`;

const notifyPaidRegistration = async (registrationId) => {
  const registrationResult = await query(
    `SELECT * FROM event_registrations WHERE id = $1`,
    [registrationId]
  );
  if (registrationResult.rowCount === 0) return;

  const registration = registrationResult.rows[0];
  if (registration.status === "cancelled") return;

  const createdTickets = await issueTicketsForRegistration(registration);
  try {
    const notifyResult = await query(
      `SELECT u.email, u.name, e.title, e.location, e.start_date, e.end_date
       FROM event_registrations er
       LEFT JOIN users u ON u.id = er.user_id
       LEFT JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [registrationId]
    );
    if (notifyResult.rowCount > 0) {
      const notify = notifyResult.rows[0];
      await sendEventTicketEmail({
        to: notify.email,
        attendeeName: notify.name,
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
        tickets: createdTickets,
      });
      await sendEventTicketMessage({
        phone: registration.contact_phone,
        attendeeName: notify.name,
        eventTitle: notify.title,
        ticketCodes: createdTickets.map((ticket) => ticket.ticket_number || ticket.ticketNumber),
      });
    }
  } catch (mailError) {
    console.warn("Paid event ticket email failed:", mailError);
  }
};

const insertOrderItems = async (orderId, items) => {
  if (!items || items.length === 0) return;
  const values = [];
  const placeholders = items.map((item, index) => {
    const baseIndex = index * 7;
    values.push(
      orderId,
      item.productId || null,
      item.name,
      item.priceCents,
      item.quantity,
      item.size || null,
      item.imageUrl || null
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
  });

  await query(
    `INSERT INTO order_items (order_id, product_id, name, price_cents, quantity, size, image_url)
     VALUES ${placeholders.join(", ")}`,
    values
  );
};

router.post("/mpesa/stkpush", requireAuth, async (req, res, next) => {
  try {
    const { phoneNumber, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!/^254\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must be a valid Kenyan mobile number" });
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId || item.id || null,
      quantity: Number(item.quantity),
      size: item.size || item.selectedSize || null,
    }));

    if (normalizedItems.some((item) => !item.productId)) {
      return res.status(400).json({ error: "Each item must include a productId" });
    }

    if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return res.status(400).json({ error: "Each item must include a valid quantity" });
    }

    const productIds = normalizedItems.map((item) => item.productId);
    const productsResult = await query(
      `SELECT id, name, price_cents, image_url, active
       FROM products
       WHERE id = ANY($1::uuid[])`,
      [productIds]
    );

    const productById = new Map(productsResult.rows.map((row) => [row.id, row]));

    const verifiedItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        return null;
      }
      if (!product.active) {
        return { error: `Product not active: ${product.name}` };
      }
      return {
        productId: product.id,
        name: product.name,
        priceCents: Number(product.price_cents),
        quantity: item.quantity,
        size: item.size || null,
        imageUrl: product.image_url || null,
      };
    });

    if (verifiedItems.some((item) => item === null)) {
      return res.status(400).json({ error: "One or more products were not found" });
    }
    const inactiveItem = verifiedItems.find((item) => item && item.error);
    if (inactiveItem) {
      return res.status(400).json({ error: inactiveItem.error });
    }

    const safeItems = verifiedItems.filter(Boolean);
    const totalCents = computeCartTotal(safeItems);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "Order total must be a positive integer" });
    }

    const amount = Math.max(1, Math.round(totalCents / 100));
    const mpesaCreds = await prepareStkPayment({
      phoneNumber: normalizedPhone,
      amount,
    });

    const orderResult = await query(
      `INSERT INTO orders (user_id, total_cents, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.user.id, totalCents]
    );
    const order = orderResult.rows[0];

    await insertOrderItems(order.id, safeItems);

    const txResult = await query(
      `INSERT INTO mpesa_transactions
         (order_id, phone_number, amount_cents, status, mpesa_environment)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [order.id, normalizedPhone, totalCents, mpesaCreds.environment]
    );
    const transaction = txResult.rows[0];

    const responseData = await sendStkPush({
      phoneNumber: normalizedPhone,
      amount,
      creds: mpesaCreds,
    });
    const newStatus = await recordStkResponse(transaction.id, responseData);

    if (newStatus === "failed") {
      return res.status(400).json({
        error: responseData.CustomerMessage || "Failed to initiate M-Pesa payment",
        orderId: order.id,
        transactionId: transaction.id,
        response: responseData,
      });
    }

    return res.status(201).json({
      orderId: order.id,
      transactionId: transaction.id,
      status: newStatus,
      response: responseData,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/mpesa/stkpush-booking", requireAuth, async (req, res, next) => {
  try {
    const { listingId, startDate, endDate, phoneNumber } = req.body;
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!/^254\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must be a valid Kenyan mobile number" });
    }

    const listingResult = await query(
      "SELECT id, title, price_cents, listing_type, status FROM listings WHERE id = $1",
      [listingId]
    );
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    const listing = listingResult.rows[0];
    if (listing.status !== "active") {
      return res.status(400).json({ error: "Listing is not available" });
    }

    const days = listing.listing_type === "rent" ? computeDays(startDate, endDate) : 1;
    const totalCents = listing.price_cents * days;
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "Invalid listing price" });
    }

    const amount = Math.max(1, Math.round(totalCents / 100));
    const mpesaCreds = await prepareStkPayment({
      phoneNumber: normalizedPhone,
      amount,
    });

    const bookingResult = await query(
      `INSERT INTO bookings (user_id, listing_id, start_date, end_date, status, payment_method, payment_status, amount_cents)
       VALUES ($1, $2, $3, $4, 'pending', 'mpesa', 'pending', $5)
       RETURNING *`,
      [req.user.id, listing.id, startDate ?? null, endDate ?? null, totalCents]
    );
    const booking = bookingResult.rows[0];

    const txResult = await query(
      `INSERT INTO mpesa_transactions
         (booking_id, phone_number, amount_cents, status, mpesa_environment)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [booking.id, normalizedPhone, totalCents, mpesaCreds.environment]
    );
    const transaction = txResult.rows[0];

    const responseData = await sendStkPush({
      phoneNumber: normalizedPhone,
      amount,
      creds: mpesaCreds,
    });
    const newStatus = await recordStkResponse(transaction.id, responseData);

    if (newStatus === "failed") {
      await query(
        "UPDATE bookings SET payment_status = $1 WHERE id = $2",
        ["failed", booking.id]
      );
      return res.status(400).json({
        error: responseData.CustomerMessage || "Failed to initiate M-Pesa payment",
        bookingId: booking.id,
        transactionId: transaction.id,
        response: responseData,
      });
    }

    return res.status(201).json({
      bookingId: booking.id,
      transactionId: transaction.id,
      status: newStatus,
      response: responseData,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/mpesa/stkpush-event-registration", requireAuth, async (req, res, next) => {
  try {
    const { registrationId, phoneNumber } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: "registrationId is required" });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!/^254\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must be a valid Kenyan mobile number" });
    }

    const registrationResult = await query(
      `SELECT er.*, e.title AS event_title
       FROM event_registrations er
       LEFT JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [registrationId]
    );
    if (registrationResult.rowCount === 0) {
      return res.status(404).json({ error: "Event registration not found" });
    }

    const registration = registrationResult.rows[0];
    if (req.user.role !== "admin" && registration.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (registration.status === "cancelled") {
      return res.status(400).json({ error: "Registration is cancelled" });
    }
    if (registration.payment_status === "paid") {
      return res.status(400).json({ error: "Registration is already paid" });
    }
    const totalCents = Number(registration.amount_cents || 0);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "This registration does not require payment" });
    }

    const amount = Math.max(1, Math.round(totalCents / 100));
    const mpesaCreds = await prepareStkPayment({
      phoneNumber: normalizedPhone,
      amount,
    });

    const creation = await withTransaction(async (client) => {
      const lockedRegistration = await client.query(
        `SELECT id, status, payment_status
         FROM event_registrations
         WHERE id = $1
         FOR UPDATE`,
        [registration.id]
      );

      if (lockedRegistration.rowCount === 0) {
        return { error: "Event registration not found", statusCode: 404 };
      }

      if (lockedRegistration.rows[0].status === "cancelled") {
        return { error: "Registration is cancelled", statusCode: 400 };
      }

      if (lockedRegistration.rows[0].payment_status === "paid") {
        return { error: "Registration is already paid", statusCode: 400 };
      }

      const existingResult = await client.query(
        `SELECT *
         FROM mpesa_transactions
         WHERE event_registration_id = $1
           AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [registration.id]
      );

      if (existingResult.rowCount > 0) {
        return {
          transaction: existingResult.rows[0],
          reused: true,
        };
      }

      await client.query(
        `UPDATE event_registrations
         SET contact_phone = COALESCE($1, contact_phone),
             payment_method = 'mpesa',
             payment_status = 'pending'
         WHERE id = $2`,
        [normalizedPhone, registration.id]
      );

      const txResult = await client.query(
        `INSERT INTO mpesa_transactions
           (event_registration_id, phone_number, amount_cents, status, mpesa_environment)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [
          registration.id,
          normalizedPhone,
          totalCents,
          mpesaCreds.environment,
        ]
      );

      return {
        transaction: txResult.rows[0],
        reused: false,
      };
    });

    if (creation.error) {
      return res.status(creation.statusCode).json({ error: creation.error });
    }

    const transaction = creation.transaction;

    if (creation.reused) {
      return res.status(200).json({
        registrationId: registration.id,
        transactionId: transaction.id,
        status: "pending",
        reused: true,
        checkoutRequestId: transaction.checkout_request_id,
        message:
          "A payment attempt is already pending for this registration. Check its status before trying again.",
      });
    }

    const responseData = await sendStkPush({
      phoneNumber: normalizedPhone,
      amount,
      accountReference: registration.event_title || undefined,
      transactionDesc: `Event ${registration.event_title || registration.id}`,
      creds: mpesaCreds,
    });
    const newStatus = await recordStkResponse(transaction.id, responseData);

    if (newStatus === "failed") {
      await query(
        "UPDATE event_registrations SET payment_status = $1 WHERE id = $2",
        ["failed", registration.id]
      );
      return res.status(400).json({
        error: responseData.CustomerMessage || "Failed to initiate M-Pesa payment",
        registrationId: registration.id,
        transactionId: transaction.id,
        response: responseData,
      });
    }

    return res.status(201).json({
      registrationId: registration.id,
      transactionId: transaction.id,
      status: newStatus,
      response: responseData,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/bank-details", async (req, res) => {
  try {
    const settingsResult = await query("SELECT * FROM site_settings WHERE id = true");
    const settings = settingsResult.rowCount > 0 ? settingsResult.rows[0] : null;
    res.json({
      bankName: settings?.bank_name || process.env.BANK_NAME || null,
      accountName: settings?.bank_account_name || process.env.BANK_ACCOUNT_NAME || null,
      accountNumber: settings?.bank_account_number || process.env.BANK_ACCOUNT_NUMBER || null,
      branch: settings?.bank_branch || process.env.BANK_BRANCH || null,
      swift: settings?.bank_swift || process.env.BANK_SWIFT || null,
      instructions: settings?.bank_instructions || process.env.BANK_INSTRUCTIONS || null,
    });
  } catch {
    res.json({
      bankName: process.env.BANK_NAME || null,
      accountName: process.env.BANK_ACCOUNT_NAME || null,
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || null,
      branch: process.env.BANK_BRANCH || null,
      swift: process.env.BANK_SWIFT || null,
      instructions: process.env.BANK_INSTRUCTIONS || null,
    });
  }
});

router.get("/crypto-details", async (req, res) => {
  const details = await getCryptoDetails();
  res.json(details);
});

router.get("/crypto-transactions", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const values = [];
    const where = [];
    if (status && status !== "all") {
      values.push(status);
      where.push(`ct.status = $${values.length}`);
    }
    const result = await query(
      `SELECT
         ct.*,
         CASE
           WHEN ct.order_id IS NOT NULL THEN 'order'
           WHEN ct.booking_id IS NOT NULL THEN 'booking'
           WHEN ct.event_registration_id IS NOT NULL THEN 'event_registration'
           ELSE 'unknown'
         END AS relation_type,
         o.id AS order_ref,
         b.id AS booking_ref,
         er.id AS registration_ref,
         l.title AS listing_title,
         e.title AS event_title
       FROM crypto_transactions ct
       LEFT JOIN orders o ON o.id = ct.order_id
       LEFT JOIN bookings b ON b.id = ct.booking_id
       LEFT JOIN listings l ON l.id = b.listing_id
       LEFT JOIN event_registrations er ON er.id = ct.event_registration_id
       LEFT JOIN events e ON e.id = er.event_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ct.created_at DESC`,
      values
    );

    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        relationType: row.relation_type,
        orderId: row.order_id,
        bookingId: row.booking_id,
        eventRegistrationId: row.event_registration_id,
        reference:
          row.order_ref?.slice?.(0, 8) ||
          row.booking_ref?.slice?.(0, 8) ||
          row.registration_ref?.slice?.(0, 8) ||
          row.id.slice(0, 8),
        label: row.listing_title || row.event_title || null,
        asset: row.asset,
        network: row.network,
        walletAddress: row.wallet_address,
        payerWallet: row.payer_wallet,
        transactionHash: row.transaction_hash,
        proofImageUrl: row.proof_image_url,
        amountCents: row.amount_cents,
        status: row.status,
        reviewNotes: row.review_notes,
        createdAt: row.created_at,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/crypto/checkout", requireAuth, async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    const cryptoDetails = await requireCryptoConfig(res);
    if (!cryptoDetails) return;

    const cryptoPayload = normalizeCryptoPayload(req.body, cryptoDetails);
    const proofError = ensureCryptoProof(cryptoPayload);
    if (proofError) {
      return res.status(400).json({ error: proofError });
    }
    const duplicateHashError = await ensureUniqueCryptoHash(cryptoPayload.transactionHash);
    if (duplicateHashError) {
      return res.status(400).json({ error: duplicateHashError });
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId || item.id || null,
      quantity: Number(item.quantity),
      size: item.size || item.selectedSize || null,
    }));

    if (normalizedItems.some((item) => !item.productId)) {
      return res.status(400).json({ error: "Each item must include a productId" });
    }

    if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return res.status(400).json({ error: "Each item must include a valid quantity" });
    }

    const productIds = normalizedItems.map((item) => item.productId);
    const productsResult = await query(
      `SELECT id, name, price_cents, image_url, active
       FROM products
       WHERE id = ANY($1::uuid[])`,
      [productIds]
    );
    const productById = new Map(productsResult.rows.map((row) => [row.id, row]));
    const verifiedItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) return null;
      if (!product.active) return { error: `Product not active: ${product.name}` };
      return {
        productId: product.id,
        name: product.name,
        priceCents: Number(product.price_cents),
        quantity: item.quantity,
        size: item.size || null,
        imageUrl: product.image_url || null,
      };
    });
    if (verifiedItems.some((item) => item === null)) {
      return res.status(400).json({ error: "One or more products were not found" });
    }
    const inactiveItem = verifiedItems.find((item) => item && item.error);
    if (inactiveItem) {
      return res.status(400).json({ error: inactiveItem.error });
    }

    const safeItems = verifiedItems.filter(Boolean);
    const totalCents = computeCartTotal(safeItems);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "Order total must be a positive integer" });
    }

    const { order, txRow } = await withTransaction(async (client) => {
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_cents, payment_method, payment_status, status)
         VALUES ($1, $2, 'crypto', 'pending', 'pending')
         RETURNING *`,
        [req.user.id, totalCents]
      );
      const order = orderResult.rows[0];
      await insertOrderItems(order.id, safeItems);
      const txResult = await client.query(
        `INSERT INTO crypto_transactions
         (order_id, asset, network, wallet_address, payer_wallet, transaction_hash, proof_image_url, amount_cents, status, response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
         RETURNING *`,
        [
          order.id,
          cryptoPayload.asset,
          cryptoPayload.network,
          cryptoPayload.walletAddress,
          cryptoPayload.payerWallet,
          cryptoPayload.transactionHash,
          cryptoPayload.proofImageUrl,
          totalCents,
          { submittedBy: req.user.id, submittedAt: new Date().toISOString() },
        ]
      );
      return { order, txRow: txResult.rows[0] };
    });

    return res.status(201).json({
      orderId: order.id,
      transactionId: txRow.id,
      status: "pending",
      paymentMethod: "crypto",
      paymentStatus: "pending",
      walletAddress: cryptoPayload.walletAddress,
      asset: cryptoPayload.asset,
      network: cryptoPayload.network,
      proofImageUrl: cryptoPayload.proofImageUrl,
      message: "Crypto payment submitted for review.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/crypto/booking", requireAuth, async (req, res, next) => {
  try {
    const { listingId, startDate, endDate } = req.body;
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const cryptoDetails = await requireCryptoConfig(res);
    if (!cryptoDetails) return;
    const cryptoPayload = normalizeCryptoPayload(req.body, cryptoDetails);
    const proofError = ensureCryptoProof(cryptoPayload);
    if (proofError) {
      return res.status(400).json({ error: proofError });
    }
    const duplicateHashError = await ensureUniqueCryptoHash(cryptoPayload.transactionHash);
    if (duplicateHashError) {
      return res.status(400).json({ error: duplicateHashError });
    }

    const listingResult = await query(
      "SELECT id, title, price_cents, listing_type, status FROM listings WHERE id = $1",
      [listingId]
    );
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    const listing = listingResult.rows[0];
    if (listing.status !== "active") {
      return res.status(400).json({ error: "Listing is not available" });
    }

    const days = listing.listing_type === "rent" ? computeDays(startDate, endDate) : 1;
    const totalCents = Number(listing.price_cents || 0) * days;
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "Invalid listing price" });
    }

    const { booking, txRow } = await withTransaction(async (client) => {
      const bookingResult = await client.query(
        `INSERT INTO bookings (user_id, listing_id, start_date, end_date, status, payment_method, payment_status, amount_cents)
         VALUES ($1, $2, $3, $4, 'pending', 'crypto', 'pending', $5)
         RETURNING *`,
        [req.user.id, listing.id, startDate ?? null, endDate ?? null, totalCents]
      );
      const booking = bookingResult.rows[0];
      const txResult = await client.query(
        `INSERT INTO crypto_transactions
         (booking_id, asset, network, wallet_address, payer_wallet, transaction_hash, proof_image_url, amount_cents, status, response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
         RETURNING *`,
        [
          booking.id,
          cryptoPayload.asset,
          cryptoPayload.network,
          cryptoPayload.walletAddress,
          cryptoPayload.payerWallet,
          cryptoPayload.transactionHash,
          cryptoPayload.proofImageUrl,
          totalCents,
          { submittedBy: req.user.id, submittedAt: new Date().toISOString() },
        ]
      );
      return { booking, txRow: txResult.rows[0] };
    });

    return res.status(201).json({
      bookingId: booking.id,
      transactionId: txRow.id,
      status: "pending",
      paymentMethod: "crypto",
      paymentStatus: "pending",
      proofImageUrl: cryptoPayload.proofImageUrl,
      message: "Crypto payment submitted for review.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/crypto/event-registration", requireAuth, async (req, res, next) => {
  try {
    const { registrationId } = req.body;
    if (!registrationId) {
      return res.status(400).json({ error: "registrationId is required" });
    }

    const cryptoDetails = await requireCryptoConfig(res);
    if (!cryptoDetails) return;
    const cryptoPayload = normalizeCryptoPayload(req.body, cryptoDetails);
    const proofError = ensureCryptoProof(cryptoPayload);
    if (proofError) {
      return res.status(400).json({ error: proofError });
    }
    const duplicateHashError = await ensureUniqueCryptoHash(cryptoPayload.transactionHash);
    if (duplicateHashError) {
      return res.status(400).json({ error: duplicateHashError });
    }

    const registrationResult = await query(
      `SELECT er.*, e.title AS event_title
       FROM event_registrations er
       LEFT JOIN events e ON e.id = er.event_id
       WHERE er.id = $1`,
      [registrationId]
    );
    if (registrationResult.rowCount === 0) {
      return res.status(404).json({ error: "Event registration not found" });
    }
    const registration = registrationResult.rows[0];
    if (req.user.role !== "admin" && registration.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (registration.status === "cancelled") {
      return res.status(400).json({ error: "Registration is cancelled" });
    }
    if (registration.payment_status === "paid") {
      return res.status(400).json({ error: "Registration is already paid" });
    }
    const totalCents = Number(registration.amount_cents || 0);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      return res.status(400).json({ error: "This registration does not require payment" });
    }

    const txRow = await withTransaction(async (client) => {
      await client.query(
        `UPDATE event_registrations
         SET contact_phone = COALESCE($1, contact_phone),
             payment_method = 'crypto',
             payment_status = 'pending'
         WHERE id = $2`,
        [req.body.contactPhone || null, registration.id]
      );
      const txResult = await client.query(
        `INSERT INTO crypto_transactions
         (event_registration_id, asset, network, wallet_address, payer_wallet, transaction_hash, proof_image_url, amount_cents, status, response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
         RETURNING *`,
        [
          registration.id,
          cryptoPayload.asset,
          cryptoPayload.network,
          cryptoPayload.walletAddress,
          cryptoPayload.payerWallet,
          cryptoPayload.transactionHash,
          cryptoPayload.proofImageUrl,
          totalCents,
          { submittedBy: req.user.id, submittedAt: new Date().toISOString() },
        ]
      );
      return txResult.rows[0];
    });

    return res.status(201).json({
      registrationId: registration.id,
      transactionId: txRow.id,
      status: "pending",
      paymentMethod: "crypto",
      paymentStatus: "pending",
      proofImageUrl: cryptoPayload.proofImageUrl,
      message: "Crypto payment submitted for review.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crypto/status/:orderId", requireAuth, async (req, res, next) => {
  try {
    const orderResult = await query("SELECT * FROM orders WHERE id = $1", [req.params.orderId]);
    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = orderResult.rows[0];
    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const txResult = await query(latestCryptoSelect.replace("%COLUMN%", "order_id"), [req.params.orderId]);
    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
    return res.json({
      order: {
        id: order.id,
        totalCents: order.total_cents,
        status: order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        paidAt: order.paid_at,
        createdAt: order.created_at,
      },
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crypto/booking-status/:bookingId", requireAuth, async (req, res, next) => {
  try {
    const bookingResult = await query("SELECT * FROM bookings WHERE id = $1", [req.params.bookingId]);
    if (bookingResult.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const booking = bookingResult.rows[0];
    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const txResult = await query(latestCryptoSelect.replace("%COLUMN%", "booking_id"), [req.params.bookingId]);
    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
    return res.json({
      booking: {
        id: booking.id,
        amountCents: booking.amount_cents,
        status: booking.status,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        paidAt: booking.paid_at,
        createdAt: booking.created_at,
      },
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crypto/event-registration-status/:registrationId", requireAuth, async (req, res, next) => {
  try {
    const registrationResult = await query(
      "SELECT * FROM event_registrations WHERE id = $1",
      [req.params.registrationId]
    );
    if (registrationResult.rowCount === 0) {
      return res.status(404).json({ error: "Event registration not found" });
    }
    const registration = registrationResult.rows[0];
    if (req.user.role !== "admin" && registration.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const txResult = await query(
      latestCryptoSelect.replace("%COLUMN%", "event_registration_id"),
      [req.params.registrationId]
    );
    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
    return res.json({
      registration: {
        id: registration.id,
        amountCents: Number(registration.amount_cents || 0),
        status: registration.status,
        paymentMethod: registration.payment_method,
        paymentStatus: registration.payment_status,
        paidAt: registration.paid_at,
        createdAt: registration.created_at,
      },
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mpesa/status/:orderId", requireAuth, async (req, res, next) => {
  try {
    const orderResult = await query("SELECT * FROM orders WHERE id = $1", [req.params.orderId]);
    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];
    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const txResult = await query(
      `SELECT * FROM mpesa_transactions
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.params.orderId]
    );

    const transaction = await reconcileable(txResult);
    return res.json({
      order: {
        id: order.id,
        totalCents: order.total_cents,
        status: order.status,
        createdAt: order.created_at,
      },
      transaction: transaction
        ? {
            id: transaction.id,
            status: transaction.status,
            checkoutRequestId: transaction.checkout_request_id,
            merchantRequestId: transaction.merchant_request_id,
            response: transaction.response,
            createdAt: transaction.created_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mpesa/booking-status/:bookingId", requireAuth, async (req, res, next) => {
  try {
    const bookingResult = await query("SELECT * FROM bookings WHERE id = $1", [req.params.bookingId]);
    if (bookingResult.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const booking = bookingResult.rows[0];
    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const txResult = await query(
      `SELECT * FROM mpesa_transactions
       WHERE booking_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.params.bookingId]
    );
    const transaction = await reconcileable(txResult);
    return res.json({
      booking: {
        id: booking.id,
        amountCents: booking.amount_cents,
        status: booking.status,
        paymentStatus: booking.payment_status,
        createdAt: booking.created_at,
      },
      transaction: transaction
        ? {
            id: transaction.id,
            status: transaction.status,
            checkoutRequestId: transaction.checkout_request_id,
            merchantRequestId: transaction.merchant_request_id,
            response: transaction.response,
            createdAt: transaction.created_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/mpesa/event-registration-status/:registrationId", requireAuth, async (req, res, next) => {
  try {
    const registrationResult = await query(
      "SELECT * FROM event_registrations WHERE id = $1",
      [req.params.registrationId]
    );
    if (registrationResult.rowCount === 0) {
      return res.status(404).json({ error: "Event registration not found" });
    }
    const registration = registrationResult.rows[0];
    if (req.user.role !== "admin" && registration.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const txResult = await query(
      `SELECT * FROM mpesa_transactions
       WHERE event_registration_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.params.registrationId]
    );
    const transaction = await reconcileable(txResult);

    return res.json({
      registration: {
        id: registration.id,
        amountCents: Number(registration.amount_cents || 0),
        status: registration.status,
        paymentStatus: registration.payment_status,
        paidAt: registration.paid_at,
        createdAt: registration.created_at,
      },
      transaction: transaction
        ? {
            id: transaction.id,
            status: transaction.status,
            checkoutRequestId: transaction.checkout_request_id,
            merchantRequestId: transaction.merchant_request_id,
            response: transaction.response,
            createdAt: transaction.created_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// Admin: manually query Safaricom for the latest status of a pending STK payment.
router.post(
  "/mpesa/admin/transactions/:id/query",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const transactionId = String(req.params.id || "");

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          transactionId
        )
      ) {
        return res.status(400).json({
          error: "Invalid transaction ID.",
        });
      }

      const existing = await query(
        `SELECT *
         FROM mpesa_transactions
         WHERE id = $1
         LIMIT 1`,
        [transactionId]
      );

      if (existing.rowCount === 0) {
        return res.status(404).json({
          error: "M-Pesa transaction not found.",
        });
      }

      const transaction = existing.rows[0];

      if (!transaction.checkout_request_id) {
        return res.status(409).json({
          error:
            "This transaction has no Checkout Request ID. Safaricom STK Query cannot be performed.",
          transaction,
        });
      }

      if (transaction.status !== "pending") {
        return res.status(200).json({
          message: `Transaction is already ${transaction.status}. No query was sent.`,
          transaction,
          queried: false,
        });
      }

      // Use the environment recorded when this STK request was initiated.
      const result = await queryCheckoutStatus(
        transaction.checkout_request_id,
        transaction.mpesa_environment || null
      );

      if (!result) {
        return res.status(502).json({
          error: "Safaricom did not return a usable STK Query response.",
        });
      }

      if (result.status) {
        await finalizeTx(transaction, result, "reconciliation");
      } else {
        // Still pending or indeterminate: retain the response for diagnostics.
        await query(
          `UPDATE mpesa_transactions
           SET response = COALESCE(response, '{}'::jsonb)
             || jsonb_build_object('reconciliation', $1::jsonb),
               result_code = COALESCE($2, result_code)
           WHERE id = $3
             AND status = 'pending'`,
          [
            JSON.stringify(result.raw || {}),
            result.resultCode != null ? String(result.resultCode) : null,
            transactionId,
          ]
        );
      }

      const refreshed = await query(
        `SELECT *
         FROM mpesa_transactions
         WHERE id = $1`,
        [transactionId]
      );

      return res.json({
        queried: true,
        status: result.status || "pending",
        resultCode: result.resultCode,
        response: result.raw,
        transaction: refreshed.rows[0] || transaction,
        message: result.status
          ? `Safaricom reports this payment as ${result.status}.`
          : "Safaricom has not returned a final payment status. The transaction remains pending.",
      });
    } catch (error) {
      console.error("Admin M-Pesa STK Query failed:", error);

      return res.status(502).json({
        error: error.message || "Unable to query Safaricom for this transaction.",
      });
    }
  }
);

// Safaricom calls these unauthenticated — gate by source IP when an
// allowlist is configured (MPESA_CALLBACK_IP_ALLOWLIST, CSV; empty = allow).
const callbackIpGuard = (req, res, next) => {
  if (CALLBACK_IP_ALLOWLIST.length === 0) return next();
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || "";
  if (!CALLBACK_IP_ALLOWLIST.includes(ip)) {
    console.warn("Rejected M-Pesa callback from non-allowlisted IP:", ip);
    return res.status(403).json({ ResultCode: 1, ResultDesc: "Rejected" });
  }
  next();
};

// STK result — path deliberately avoids the word "mpesa", which Daraja
// rejects in callback URLs.
router.post(
  "/stk/result",
  callbackIpGuard,
  async (req, res) => {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      return res.status(400).json({
        ResultCode: 1,
        ResultDesc: "Invalid callback payload",
      });
    }

    const checkoutRequestId = callback.CheckoutRequestID || null;
    let inboxId;

    try {
      inboxId = await saveDarajaCallback({
        callbackType: "stk",
        providerReference: checkoutRequestId,
        payload: callback,
      });
    } catch (error) {
      console.error("Failed to persist STK callback:", error);
      return res.status(500).json({
        ResultCode: 1,
        ResultDesc: "Callback persistence failed",
      });
    }

    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    if (!checkoutRequestId) {
      await query(
        `UPDATE mpesa_callback_inbox
         SET processing_status = 'failed',
             processing_error = 'Missing CheckoutRequestID',
             processing_attempts = processing_attempts + 1,
             last_attempt_at = now()
         WHERE id = $1`,
        [inboxId]
      );
      return;
    }

    try {
      await query(
        `UPDATE mpesa_callback_inbox
         SET processing_status = 'processing',
             processing_attempts = processing_attempts + 1,
             last_attempt_at = now()
         WHERE id = $1`,
        [inboxId]
      );

      const resultCode = String(callback.ResultCode);
      const metadata = parseCallbackItems(callback);

      if (resultCode === "0") {
        const txResult = await query(
          `SELECT *
           FROM mpesa_transactions
           WHERE checkout_request_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [checkoutRequestId]
        );
        if (txResult.rowCount === 0) {
          throw new Error("No payment record matched the CheckoutRequestID");
        }

        const finalization = await finalizeTx(
          txResult.rows[0],
          {
            status: "paid",
            resultCode,
            amount: metadata.amount,
            mpesaReceiptNumber: metadata.mpesaReceiptNumber,
            phoneNumber: metadata.phoneNumber,
            transactionDate: metadata.transactionDate,
            raw: callback,
          },
          "callback"
        );

        if (finalization?.verificationFailed) {
          await query(
            `UPDATE mpesa_callback_inbox
             SET processing_status = 'failed',
                 processing_error = $1,
                 processed_at = NULL
             WHERE id = $2`,
            [finalization.verificationProblems.join("; "), inboxId]
          );
          return;
        }
      } else {
        await settleMpesaTransaction({
          checkoutRequestId,
          status: "failed",
          metadata,
          rawPayload: callback,
          source: "callback",
        });
      }

      await query(
        `UPDATE mpesa_callback_inbox
         SET processing_status = 'processed',
             processing_error = NULL,
             processed_at = now()
         WHERE id = $1`,
        [inboxId]
      );
    } catch (error) {
      console.error("STK callback processing failed:", error);
      await query(
        `UPDATE mpesa_callback_inbox
         SET processing_status = 'retry',
             processing_error = $1
         WHERE id = $2`,
        [String(error?.message || "Callback processing failed").slice(0, 2000), inboxId]
      ).catch((dbError) => {
        console.error("Failed to update callback inbox status:", dbError);
      });
    }
  }
);

// C2B validation — Safaricom blocks/rejects the payment based on our
// synchronous response, so accept everything and let reconciliation decide.
router.post("/c2b/validation", callbackIpGuard, (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// C2B confirmation — a completed manual paybill payment. Record it
// (deduped by TransID) and ack so Safaricom stops retrying.
router.post("/c2b/confirmation", callbackIpGuard, async (req, res) => {
  const row = parseC2bConfirmation(req.body);
  if (!row.transactionId) {
    return res.status(400).json({
      ResultCode: 1,
      ResultDesc: "Missing transaction ID",
    });
  }

  let inboxId;
  try {
    inboxId = await saveDarajaCallback({
      callbackType: "c2b",
      providerReference: row.transactionId,
      payload: req.body,
    });
  } catch (error) {
    console.error("C2B callback persistence failed:", error);
    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback persistence failed",
    });
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processing',
           processing_attempts = processing_attempts + 1,
           last_attempt_at = now()
       WHERE id = $1`,
      [inboxId]
    );
    await recordC2bTransactions([row], "c2b");
    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processed',
           processed_at = now(),
           processing_error = NULL
       WHERE id = $1`,
      [inboxId]
    );
  } catch (error) {
    console.error("C2B confirmation processing failed:", error);
    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'retry',
           processing_error = $1
       WHERE id = $2`,
      [String(error?.message || "C2B processing failed").slice(0, 2000), inboxId]
    ).catch((dbError) => {
      console.error("C2B inbox update failed:", dbError);
    });
  }
});

// Async response to /mpesa/pull/register arrives here; nothing to do beyond
// logging — the register endpoint returns the sync response already.
router.post("/pull/result", callbackIpGuard, async (req, res) => {
  let inboxId;

  try {
    inboxId = await saveDarajaCallback({
      callbackType: "pull",
      providerReference:
        req.body?.TransID ||
        req.body?.TransactionID ||
        req.body?.ResponseCode ||
        null,
      payload: req.body,
    });
  } catch (error) {
    console.error("Pull callback persistence failed:", error);
    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback persistence failed",
    });
  }

  // Acknowledge only after the raw callback has been durably stored.
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processing',
           processing_attempts = processing_attempts + 1,
           last_attempt_at = now()
       WHERE id = $1`,
      [inboxId]
    );

    let rows = parsePullRows(req.body);

    if (rows.length === 0) {
      const single = parseC2bConfirmation(req.body);
      if (single.transactionId) rows = [single];
    }

    if (rows.length > 0) {
      await recordC2bTransactions(rows, "pull_callback");
    }

    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'processed',
           processing_error = $1,
           processed_at = now()
       WHERE id = $2`,
      [
        rows.length > 0
          ? null
          : "Callback stored, but no transaction rows were recognized; inspect raw payload.",
        inboxId,
      ]
    );
  } catch (error) {
    console.error("Pull callback processing failed:", error);

    await query(
      `UPDATE mpesa_callback_inbox
       SET processing_status = 'retry',
           processing_error = $1
       WHERE id = $2`,
      [
        String(error?.message || "Pull callback processing failed").slice(0, 2000),
        inboxId,
      ]
    ).catch((dbError) => {
      console.error("Pull inbox update failed:", dbError);
    });
  }
});

router.get(
  "/mpesa/admin/error-catalogue",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.json({
      catalogue: getDarajaErrorCatalogue(),
    });
  }
);

// Admin: inspect the callback inbox.
router.get(
  "/mpesa/admin/callback-inbox",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const limit = Math.min(
        100,
        Math.max(1, Number(req.query.limit) || 50)
      );
      const status = String(req.query.status || "all");
      const allowedStatuses = [
        "received",
        "processing",
        "processed",
        "retry",
        "failed",
      ];

      if (status !== "all" && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid callback inbox status.",
        });
      }

      const result = await query(
        `SELECT
           id,
           callback_type,
           provider_reference,
           processing_status,
           processing_attempts,
           processing_error,
           received_at,
           processed_at,
           last_attempt_at
         FROM mpesa_callback_inbox
         ${status === "all" ? "" : "WHERE processing_status = $1"}
         ORDER BY received_at DESC
         LIMIT ${limit}`,
        status === "all" ? [] : [status]
      );

      return res.json({
        items: result.rows,
        count: result.rowCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin: replay one stored callback.
router.post(
  "/mpesa/admin/callback-inbox/:id/retry",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id
        )
      ) {
        return res.status(400).json({
          error: "Invalid callback inbox ID.",
        });
      }

      const claim = await query(
        `UPDATE mpesa_callback_inbox
         SET processing_status = 'processing',
             processing_attempts = processing_attempts + 1,
             last_attempt_at = now(),
             processing_error = NULL
         WHERE id = $1
           AND processing_status IN ('received', 'retry')
         RETURNING *`,
        [id]
      );

      if (claim.rowCount === 0) {
        const current = await query(
          `SELECT processing_status
           FROM mpesa_callback_inbox
           WHERE id = $1`,
          [id]
        );

        if (current.rowCount === 0) {
          return res.status(404).json({
            error: "Callback inbox record not found.",
          });
        }

        return res.status(409).json({
          error:
            `Callback cannot be retried from status '${current.rows[0].processing_status}'.`,
        });
      }

      const inbox = claim.rows[0];

      try {
        await processStoredDarajaCallback(inbox);

        await query(
          `UPDATE mpesa_callback_inbox
           SET processing_status = 'processed',
               processed_at = now(),
               processing_error = NULL
           WHERE id = $1
             AND processing_status = 'processing'`,
          [id]
        );

        return res.json({
          ok: true,
          message: "Callback successfully processed.",
          id,
        });
      } catch (processingError) {
        const message = String(
          processingError?.message || "Callback processing failed"
        ).slice(0, 2000);

        await query(
          `UPDATE mpesa_callback_inbox
           SET processing_status = 'retry',
               processing_error = $1
           WHERE id = $2`,
          [message, id]
        );

        return res.status(422).json({
          ok: false,
          error: message,
          id,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// Admin: recover multiple pending callback-processing failures.
router.post(
  "/mpesa/admin/callback-inbox/retry-batch",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const limit = Math.min(
        25,
        Math.max(1, Number(req.body?.limit) || 10)
      );

      const claimed = await query(
        `WITH candidates AS (
           SELECT id
           FROM mpesa_callback_inbox
           WHERE processing_status IN ('received', 'retry')
              OR (
                processing_status = 'processing'
                AND last_attempt_at < now() - interval '5 minutes'
              )
           ORDER BY received_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE mpesa_callback_inbox AS inbox
         SET processing_status = 'processing',
             processing_attempts = inbox.processing_attempts + 1,
             processing_error = NULL,
             last_attempt_at = now()
         FROM candidates
         WHERE inbox.id = candidates.id
         RETURNING inbox.*`,
        [limit]
      );

      const outcomes = [];

      for (const inbox of claimed.rows) {
        try {
          await processStoredDarajaCallback(inbox);

          await query(
            `UPDATE mpesa_callback_inbox
             SET processing_status = 'processed',
                 processed_at = now(),
                 processing_error = NULL
             WHERE id = $1
               AND processing_status = 'processing'`,
            [inbox.id]
          );

          outcomes.push({
            id: inbox.id,
            status: "processed",
          });
        } catch (error) {
          const message = String(
            error?.message || "Callback processing failed"
          ).slice(0, 2000);

          await query(
            `UPDATE mpesa_callback_inbox
             SET processing_status = 'retry',
                 processing_error = $1
             WHERE id = $2
               AND processing_status = 'processing'`,
            [message, inbox.id]
          );

          outcomes.push({
            id: inbox.id,
            status: "retry",
            error: message,
          });
        }
      }

      return res.json({
        ok: true,
        claimed: claimed.rowCount,
        outcomes,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
