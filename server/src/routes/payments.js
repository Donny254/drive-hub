import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { issueTicketsForRegistration } from "../utils/eventTickets.js";
import { sendEventTicketEmail } from "../email.js";
import { sendEventTicketMessage } from "../notifications.js";
import { decryptSecret } from "../utils/secrets.js";

const router = Router();

const mpesaEnv = process.env.MPESA_ENV || "sandbox";
const mpesaBaseUrl =
  mpesaEnv === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

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

// Daraja rate-limits OAuth token issuance, so cache the token in memory and
// de-duplicate concurrent refreshes (single flight).
let cachedToken = null;
let tokenInflight = null;

// Credentials resolve from site_settings (admin UI, encrypted at rest) first,
// falling back to environment variables. The token cache below is shared by
// whichever source is active — a credential change takes effect when the
// cached token expires (≤1h); restart to rotate immediately.
const getMpesaCredentials = async () => {
  const row = await loadSettingsRow().catch(() => null);
  const secret = (enc, envName) => (enc ? decryptSecret(enc) : null) || process.env[envName] || null;
  return {
    consumerKey: secret(row?.mpesa_consumer_key_enc, "MPESA_CONSUMER_KEY"),
    consumerSecret: secret(row?.mpesa_consumer_secret_enc, "MPESA_CONSUMER_SECRET"),
    shortcode: row?.mpesa_shortcode || process.env.MPESA_SHORTCODE || null,
    passkey: secret(row?.mpesa_passkey_enc, "MPESA_PASSKEY"),
    partyB: row?.mpesa_partyb || process.env.MPESA_PARTYB || null,
    accountReference:
      row?.mpesa_account_reference || process.env.MPESA_ACCOUNT_REFERENCE || "WheelsnationKe Order",
    transactionDesc:
      row?.mpesa_transaction_desc || process.env.MPESA_TRANSACTION_DESC || "WheelsnationKe checkout",
  };
};

const darajaFetch = async (path, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DARAJA_TIMEOUT_MS);
  try {
    return await fetch(`${mpesaBaseUrl}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const getAccessToken = async ({ consumerKey, consumerSecret }) => {
  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing M-Pesa consumer key/secret");
  }
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) return cachedToken.token;
  if (tokenInflight) return tokenInflight;

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  tokenInflight = (async () => {
    const response = await darajaFetch("/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get M-Pesa token: ${text}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("M-Pesa token response missing access_token");
    }
    const ttlSeconds = Math.max(60, Number(data.expires_in || 3599) - TOKEN_TTL_SKEW_SECONDS);
    cachedToken = { token: data.access_token, expiresAtMs: Date.now() + ttlSeconds * 1000 };
    return cachedToken.token;
  })().finally(() => {
    tokenInflight = null;
  });

  return tokenInflight;
};

const buildStkPayload = ({ phoneNumber, amount, creds }) => {
  const { MPESA_CALLBACK_URL } = process.env;
  if (!creds?.shortcode || !creds?.passkey) {
    throw new Error("Missing M-Pesa shortcode/passkey (set them in admin settings or environment)");
  }
  if (!MPESA_CALLBACK_URL) {
    throw new Error("Missing M-Pesa callback URL");
  }

  const timestamp = formatTimestampEAT();
  const password = Buffer.from(`${creds.shortcode}${creds.passkey}${timestamp}`).toString(
    "base64"
  );

  return {
    BusinessShortCode: creds.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: creds.partyB || creds.shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: creds.accountReference,
    TransactionDesc: creds.transactionDesc,
  };
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

const sendStkPush = async ({ phoneNumber, amount, accountReference, transactionDesc }) => {
  const creds = await getMpesaCredentials();
  const accessToken = await getAccessToken(creds);
  const payload = buildStkPayload({ phoneNumber, amount, creds });
  // Daraja caps these fields in production (12 and 13 chars).
  if (accountReference) payload.AccountReference = String(accountReference).slice(0, 12);
  if (transactionDesc) payload.TransactionDesc = String(transactionDesc).slice(0, 13);

  const response = await darajaFetch("/mpesa/stkpush/v1/processrequest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.json().catch(() => ({}));
};

const recordStkResponse = async (transactionId, responseData) => {
  const responseCode = responseData.ResponseCode ?? responseData.responseCode;
  const status = responseCode === "0" ? "pending" : "failed";
  await query(
    `UPDATE mpesa_transactions
     SET checkout_request_id = $1,
         merchant_request_id = $2,
         response = $3,
         status = $4
     WHERE id = $5`,
    [
      responseData.CheckoutRequestID || null,
      responseData.MerchantRequestID || null,
      responseData,
      status,
      transactionId,
    ]
  );
  return status;
};

// Probes Daraja for a transaction whose callback may have been lost.
// Returns { status: 'paid'|'failed'|null, raw, amount, mpesaReceiptNumber } —
// status null means "still in flight / unknown", leave it pending.
export const queryCheckoutStatus = async (checkoutRequestId) => {
  if (!checkoutRequestId) return null;
  const creds = await getMpesaCredentials();
  if (!creds.shortcode || !creds.passkey) return null;

  const timestamp = formatTimestampEAT();
  const accessToken = await getAccessToken(creds);
  const response = await darajaFetch("/mpesa/stkpushquery/v1/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: creds.shortcode,
      Password: Buffer.from(`${creds.shortcode}${creds.passkey}${timestamp}`).toString("base64"),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (data.ResultCode == null) return null;
  const resultCode = String(data.ResultCode);
  return {
    status:
      resultCode === "0"
        ? "paid"
        : FINAL_FAILED_RESULT_CODES.has(resultCode)
          ? "failed"
          : null,
    raw: data,
    ...parseCallbackItems(data),
  };
};

// Applies a final result to a pending transaction exactly once (the
// `status = 'pending'` guard makes duplicate callbacks / poll races a no-op)
// and cascades to the order/booking/registration it paid for.
export const settleMpesaTransaction = async ({ checkoutRequestId, status, metadata = {}, rawPayload }) => {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `UPDATE mpesa_transactions
       SET status = $1,
           response = $2,
           result_code = $3,
           mpesa_receipt_number = COALESCE($4, mpesa_receipt_number)
       WHERE checkout_request_id = $5 AND status = 'pending'
       RETURNING order_id, booking_id, event_registration_id`,
      [
        status,
        rawPayload,
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
const finalizeTx = async (txRow, result) => {
  const expectedKes = Math.round(Number(txRow.amount_cents || 0) / 100);
  if (result.status === "paid" && result.amount != null && Number(result.amount) !== expectedKes) {
    console.warn(
      `M-Pesa amount mismatch for tx ${txRow.id}: expected KES ${expectedKes}, callback reports KES ${result.amount}. Left pending for review.`
    );
    await query(`UPDATE mpesa_transactions SET response = $1 WHERE id = $2`, [
      result.raw,
      txRow.id,
    ]);
    return;
  }
  await settleMpesaTransaction({
    checkoutRequestId: txRow.checkout_request_id,
    status: result.status,
    metadata: result,
    rawPayload: result.raw,
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
    const result = await queryCheckoutStatus(transaction.checkout_request_id);
    if (!result?.status) return transaction;
    await finalizeTx(transaction, result);
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
  if (!Array.isArray(response)) return [];
  return response
    .flat()
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
    const pick = (...keys) => {
      for (const key of keys) {
        const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
        if (found && row[found] != null) return String(row[found]);
      }
      return null;
    };
    const amount = pick("transAmount");
    return {
      transactionId: pick("transID") || "",
      transactionType: pick("transactionType"),
      transTime: pick("transTime"),
      amountCents: amount != null ? Math.round(Number(amount) * 100) : null,
      businessShortCode: pick("businessShortCode"),
      billRefNumber: pick("billRefNumber"),
      msisdn: pick("msisdn"),
      orgAccountBalance: pick("orgAccountBalance"),
    };
  });
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

// Base URL for webhook registration: MPESA_CALLBACK_BASE_URL if set, else
// derived from MPESA_CALLBACK_URL by stripping its path.
const callbackBaseUrl = () => {
  if (process.env.MPESA_CALLBACK_BASE_URL) {
    return process.env.MPESA_CALLBACK_BASE_URL.replace(/\/$/, "");
  }
  const url = process.env.MPESA_CALLBACK_URL || "";
  return url.replace(/\/[^/]*$/, "");
};

const darajaAdminPost = async (path, body) => {
  const creds = await getMpesaCredentials();
  const accessToken = await getAccessToken(creds);
  const response = await darajaFetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({}));
};

router.post("/mpesa/register-url", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const creds = await getMpesaCredentials();
    if (!creds.shortcode) {
      return res.status(400).json({ error: "M-Pesa shortcode not configured" });
    }
    const base = callbackBaseUrl();
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
      return res.status(400).json({ error: "M-Pesa shortcode not configured" });
    }
    const nominatedNumber = normalizePhone(req.body.nominatedNumber);
    if (!/^254\d{9}$/.test(nominatedNumber)) {
      return res.status(400).json({ error: "nominatedNumber must be a valid Kenyan mobile number" });
    }
    const base = callbackBaseUrl();
    if (!base || !/^https:\/\//.test(base)) {
      return res.status(400).json({ error: "Set MPESA_CALLBACK_BASE_URL (https) to register pull callbacks" });
    }

    const responseData = await darajaAdminPost("/pulltransactions/v1/register", {
      ShortCode: creds.shortcode,
      RequestType: "Pull",
      NominatedNumber: nominatedNumber,
      CallBackURL: `${base}/pull/result`,
    });

    res.json({ ok: true, response: responseData });
  } catch (error) {
    next(error);
  }
});

router.post("/mpesa/pull/query", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const creds = await getMpesaCredentials();
    if (!creds.shortcode) {
      return res.status(400).json({ error: "M-Pesa shortcode not configured" });
    }
    const startDate = req.body.startDate;
    const endDate = req.body.endDate || startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ""))) {
      return res.status(400).json({ error: "startDate (YYYY-MM-DD) is required" });
    }

    const data = await darajaAdminPost("/pulltransactions/v1/query", {
      ShortCode: creds.shortcode,
      StartDate: startDate,
      EndDate: endDate,
      OffSetValue: req.body.offsetValue || "0",
    });

    // Pull defines its own codes: 1000 success, 1001 no records.
    const responseCode = String(data.ResponseCode ?? "");
    const rows = parsePullRows(data.Response);
    const stored = rows.length > 0 ? await recordC2bTransactions(rows, "pull") : 0;

    res.json({
      responseCode,
      responseMessage: data.ResponseMessage || data["Response Message"] || null,
      fetched: rows.length,
      newTransactions: stored,
      transactions: rows,
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

    const orderResult = await query(
      `INSERT INTO orders (user_id, total_cents, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.user.id, totalCents]
    );
    const order = orderResult.rows[0];

    await insertOrderItems(order.id, safeItems);

    const txResult = await query(
      `INSERT INTO mpesa_transactions (order_id, phone_number, amount_cents, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [order.id, normalizedPhone, totalCents]
    );
    const transaction = txResult.rows[0];

    const responseData = await sendStkPush({ phoneNumber: normalizedPhone, amount });
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

    const bookingResult = await query(
      `INSERT INTO bookings (user_id, listing_id, start_date, end_date, status, payment_method, payment_status, amount_cents)
       VALUES ($1, $2, $3, $4, 'pending', 'mpesa', 'pending', $5)
       RETURNING *`,
      [req.user.id, listing.id, startDate ?? null, endDate ?? null, totalCents]
    );
    const booking = bookingResult.rows[0];

    const txResult = await query(
      `INSERT INTO mpesa_transactions (booking_id, phone_number, amount_cents, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [booking.id, normalizedPhone, totalCents]
    );
    const transaction = txResult.rows[0];

    const amount = Math.max(1, Math.round(totalCents / 100));
    const responseData = await sendStkPush({ phoneNumber: normalizedPhone, amount });
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
    await query(
      `UPDATE event_registrations
       SET contact_phone = COALESCE($1, contact_phone),
           payment_method = 'mpesa',
           payment_status = 'pending'
       WHERE id = $2`,
      [normalizedPhone, registration.id]
    );

    const txResult = await query(
      `INSERT INTO mpesa_transactions (event_registration_id, phone_number, amount_cents, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [registration.id, normalizedPhone, totalCents]
    );
    const transaction = txResult.rows[0];

    const responseData = await sendStkPush({
      phoneNumber: normalizedPhone,
      amount,
      accountReference: registration.event_title || undefined,
      transactionDesc: `Event ${registration.event_title || registration.id}`,
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
  async (req, res, next) => {
    try {
      const callback = req.body?.Body?.stkCallback;
      if (!callback) {
        return res.status(400).json({ error: "Invalid callback payload" });
      }

      const checkoutRequestId = callback.CheckoutRequestID;
      const status = String(callback.ResultCode) === "0" ? "paid" : "failed";

      // Acknowledge quickly and settle outside the response path so Safaricom
      // never times out on us; settleMpesaTransaction is idempotent.
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });

      if (!checkoutRequestId) return;

      try {
        if (status === "paid") {
          const txResult = await query(
            "SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1 ORDER BY created_at DESC LIMIT 1",
            [checkoutRequestId]
          );
          if (txResult.rowCount > 0) {
            await finalizeTx(txResult.rows[0], { ...parseCallbackItems(callback), raw: callback });
            return;
          }
        }
        await settleMpesaTransaction({
          checkoutRequestId,
          status,
          metadata: parseCallbackItems(callback),
          rawPayload: callback,
        });
      } catch (error) {
        console.error("M-Pesa callback settlement failed:", error);
      }
    } catch (error) {
      next(error);
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
router.post("/c2b/confirmation", callbackIpGuard, async (req, res, next) => {
  try {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    const row = parseC2bConfirmation(req.body);
    if (!row.transactionId) return;
    const inserted = await recordC2bTransactions([row], "c2b");
    if (inserted > 0) {
      console.log(`C2B confirmation recorded: ${row.transactionId} KES ${(row.amountCents || 0) / 100} from ${row.msisdn} ref=${row.billRefNumber}`);
    }
  } catch (error) {
    console.error("C2B confirmation handling failed:", error);
  }
});

// Async response to /mpesa/pull/register arrives here; nothing to do beyond
// logging — the register endpoint returns the sync response already.
router.post("/pull/result", callbackIpGuard, (req, res) => {
  console.log("Pull registration callback:", JSON.stringify(req.body).slice(0, 500));
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

export default router;
