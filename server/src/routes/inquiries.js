import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendInquiryEmail, sendInquiryReceiptEmail, sendListingInquiryEmail } from "../email.js";
import { sendInquiryReceiptMessage } from "../notifications.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  listingId: row.listing_id,
  inquiryType: row.inquiry_type,
  name: row.name,
  email: row.email,
  phone: row.phone,
  message: row.message,
  status: row.status,
  handledAt: row.handled_at,
  createdAt: row.created_at,
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, l.title AS listing_title
       FROM inquiries i
       LEFT JOIN listings l ON l.id = i.listing_id
       ORDER BY i.created_at DESC`
    );
    res.json(result.rows.map((row) => ({ ...toApi(row), listingTitle: row.listing_title || null })));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { listingId, inquiryType = "general", name, email, phone, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: "Name and message are required" });
    }
    if (!["general", "listing", "quote", "service"].includes(inquiryType)) {
      return res.status(400).json({ error: "Invalid inquiry type" });
    }

    const result = await query(
      `INSERT INTO inquiries (listing_id, inquiry_type, name, email, phone, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *`,
      [listingId || null, inquiryType, name, email || null, phone || null, message]
    );
    const listingTitleResult = listingId
      ? await query(
          `SELECT l.title, u.email AS seller_email, u.name AS seller_name
           FROM listings l
           LEFT JOIN users u ON u.id = l.user_id
           WHERE l.id = $1`,
          [listingId]
        )
      : { rows: [] };
    const listingTitle = listingTitleResult.rows[0]?.title ?? null;
    const sellerEmail = listingTitleResult.rows[0]?.seller_email ?? null;
    const sellerName = listingTitleResult.rows[0]?.seller_name ?? null;
    try {
      await sendInquiryEmail(result.rows[0], listingTitle);
      await sendListingInquiryEmail({
        to: sellerEmail,
        inquiry: result.rows[0],
        listingTitle,
        sellerName,
      });
      await sendInquiryReceiptEmail({
        to: email || null,
        name,
        listingTitle,
      });
      await sendInquiryReceiptMessage({
        phone: phone || null,
        name,
        listingTitle,
      });
    } catch (err) {
      console.warn("Inquiry email failed:", err);
    }
    res.status(201).json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["open", "handled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const handledAt = status === "handled" ? new Date().toISOString() : null;
    const result = await query(
      `UPDATE inquiries
       SET status = $1, handled_at = $2
       WHERE id = $3
       RETURNING *`,
      [status, handledAt, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Inquiry not found" });
    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

export default router;
