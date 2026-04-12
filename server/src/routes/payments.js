import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { issueTicketsForRegistration } from "../utils/eventTickets.js";
import { sendEventTicketEmail } from "../email.js";
import { sendEventTicketMessage } from "../notifications.js";

const router = Router();

const mpesaEnv = process.env.MPESA_ENV || "sandbox";
const mpesaBaseUrl =
  mpesaEnv === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

const normalizePhone = (value) => {
  if (!value) return "";
  let phone = String(value).replace(/\s+/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) return `254${phone.slice(1)}`;
  if (phone.startsWith("7")) return `254${phone}`;
  return phone;
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

const getAccessToken = async () => {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error("Missing M-Pesa consumer key/secret");
  }

  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString(
    "base64"
  );

  const response = await fetch(
    `${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get M-Pesa token: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("M-Pesa token response missing access_token");
  }
  return data.access_token;
};

const buildStkPayload = ({ phoneNumber, amount }) => {
  const { MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL } = process.env;
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    throw new Error("Missing M-Pesa shortcode/passkey/callback URL");
  }

  const timestamp = formatTimestampEAT();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString(
    "base64"
  );

  const partyB = process.env.MPESA_PARTYB || MPESA_SHORTCODE;
  const accountReference = process.env.MPESA_ACCOUNT_REFERENCE || "WheelsnationKe Order";
  const transactionDesc = process.env.MPESA_TRANSACTION_DESC || "WheelsnationKe checkout";

  return {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: partyB,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };
};

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
  if (!payload.transactionHash) {
    return "Transaction hash is required";
  }
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

    const accessToken = await getAccessToken();
    const payload = buildStkPayload({ phoneNumber: normalizedPhone, amount });

    const response = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));
    const responseCode = responseData.ResponseCode ?? responseData.responseCode;
    const newStatus = response.ok && responseCode === "0" ? "pending" : "failed";

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
        newStatus,
        transaction.id,
      ]
    );

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
    const accessToken = await getAccessToken();
    const payload = buildStkPayload({ phoneNumber: normalizedPhone, amount });

    const response = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));
    const responseCode = responseData.ResponseCode ?? responseData.responseCode;
    const newStatus = response.ok && responseCode === "0" ? "pending" : "failed";

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
        newStatus,
        transaction.id,
      ]
    );

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

    const accessToken = await getAccessToken();
    const payload = buildStkPayload({
      phoneNumber: normalizedPhone,
      amount,
    });
    payload.AccountReference = registration.event_title || process.env.MPESA_ACCOUNT_REFERENCE || "WheelsnationKe Order";
    payload.TransactionDesc = `Event ticket ${registration.event_title || registration.id}`;

    const response = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));
    const responseCode = responseData.ResponseCode ?? responseData.responseCode;
    const newStatus = response.ok && responseCode === "0" ? "pending" : "failed";

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
        newStatus,
        transaction.id,
      ]
    );

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

    const orderResult = await query(
      `INSERT INTO orders (user_id, total_cents, payment_method, payment_status, status)
       VALUES ($1, $2, 'crypto', 'pending', 'pending')
       RETURNING *`,
      [req.user.id, totalCents]
    );
    const order = orderResult.rows[0];
    await insertOrderItems(order.id, safeItems);

    const txResult = await query(
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
        {
          submittedBy: req.user.id,
          submittedAt: new Date().toISOString(),
        },
      ]
    );

    return res.status(201).json({
      orderId: order.id,
      transactionId: txResult.rows[0].id,
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

    const bookingResult = await query(
      `INSERT INTO bookings (user_id, listing_id, start_date, end_date, status, payment_method, payment_status, amount_cents)
       VALUES ($1, $2, $3, $4, 'pending', 'crypto', 'pending', $5)
       RETURNING *`,
      [req.user.id, listing.id, startDate ?? null, endDate ?? null, totalCents]
    );
    const booking = bookingResult.rows[0];

    const txResult = await query(
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
        {
          submittedBy: req.user.id,
          submittedAt: new Date().toISOString(),
        },
      ]
    );

    return res.status(201).json({
      bookingId: booking.id,
      transactionId: txResult.rows[0].id,
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

    await query(
      `UPDATE event_registrations
       SET contact_phone = COALESCE($1, contact_phone),
           payment_method = 'crypto',
           payment_status = 'pending'
       WHERE id = $2`,
      [req.body.contactPhone || null, registration.id]
    );

    const txResult = await query(
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
        {
          submittedBy: req.user.id,
          submittedAt: new Date().toISOString(),
        },
      ]
    );

    return res.status(201).json({
      registrationId: registration.id,
      transactionId: txResult.rows[0].id,
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

    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
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
    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;
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
    const transaction = txResult.rowCount > 0 ? txResult.rows[0] : null;

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

router.post("/mpesa/callback", async (req, res, next) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      return res.status(400).json({ error: "Invalid callback payload" });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;
    const status = resultCode === 0 ? "paid" : "failed";

    const txResult = await query(
      `UPDATE mpesa_transactions
       SET status = $1,
           response = $2
       WHERE checkout_request_id = $3
       RETURNING order_id, booking_id, event_registration_id`,
      [status, callback, checkoutRequestId]
    );

    if (txResult.rowCount > 0) {
      const {
        order_id: orderId,
        booking_id: bookingId,
        event_registration_id: eventRegistrationId,
      } = txResult.rows[0];
      if (orderId) {
        const orderStatus = status === "paid" ? "paid" : "cancelled";
        await query("UPDATE orders SET status = $1 WHERE id = $2", [orderStatus, orderId]);
      }
      if (bookingId) {
        const paymentStatus = status === "paid" ? "paid" : "failed";
        const paidAt = status === "paid" ? new Date().toISOString() : null;
        await query(
          "UPDATE bookings SET payment_status = $1, paid_at = $2 WHERE id = $3",
          [paymentStatus, paidAt, bookingId]
        );
      }
      if (eventRegistrationId) {
        const paymentStatus = status === "paid" ? "paid" : "failed";
        const paidAt = status === "paid" ? new Date().toISOString() : null;
        const registrationStatus = status === "paid" ? "confirmed" : "pending";
        await query(
          `UPDATE event_registrations
           SET payment_status = $1,
               paid_at = $2,
               status = CASE WHEN status = 'cancelled' THEN status ELSE $3 END
           WHERE id = $4
           RETURNING *`,
          [paymentStatus, paidAt, registrationStatus, eventRegistrationId]
        );
        if (status === "paid") {
          await notifyPaidRegistration(eventRegistrationId);
        }
      }
    }

    return res.json({ resultCode: 0, resultDesc: "Accepted" });
  } catch (error) {
    next(error);
  }
});

export default router;
