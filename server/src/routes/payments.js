import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

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
  const accountReference = process.env.MPESA_ACCOUNT_REFERENCE || "DriveHub Order";
  const transactionDesc = process.env.MPESA_TRANSACTION_DESC || "DriveHub checkout";

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

router.get("/bank-details", async (req, res) => {
  res.json({
    bankName: process.env.BANK_NAME || null,
    accountName: process.env.BANK_ACCOUNT_NAME || null,
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || null,
    branch: process.env.BANK_BRANCH || null,
    swift: process.env.BANK_SWIFT || null,
    instructions: process.env.BANK_INSTRUCTIONS || null,
  });
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
       RETURNING order_id, booking_id`,
      [status, callback, checkoutRequestId]
    );

    if (txResult.rowCount > 0) {
      const { order_id: orderId, booking_id: bookingId } = txResult.rows[0];
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
    }

    return res.json({ resultCode: 0, resultDesc: "Accepted" });
  } catch (error) {
    next(error);
  }
});

export default router;
