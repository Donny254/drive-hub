import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendListingBidEmail } from "../email.js";
import { sendListingBidMessage } from "../notifications.js";
import { minNextBidCents, closeAuctionById } from "../auctions.js";

const router = Router();

const allowedStatuses = new Set(["pending", "accepted", "rejected"]);

const toApi = (row) => ({
  id: row.id,
  listingId: row.listing_id,
  listingTitle: row.listing_title || null,
  listingPriceCents: row.listing_price_cents == null ? null : Number(row.listing_price_cents),
  listingImageUrl: row.listing_image_url || null,
  sellerId: row.seller_id || null,
  sellerName: row.seller_name || null,
  userId: row.user_id || null,
  bidderName: row.bidder_name,
  bidderEmail: row.bidder_email || null,
  bidderPhone: row.bidder_phone || null,
  amountCents: Number(row.amount_cents || 0),
  message: row.message || null,
  status: row.status,
  handledAt: row.handled_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseAmountCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const params = [];
    const where = [];

    if (req.user.role !== "admin") {
      params.push(req.user.id);
      where.push(`l.user_id = $${params.length}`);
    }

    if (req.query.status) {
      if (!allowedStatuses.has(req.query.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      params.push(req.query.status);
      where.push(`lb.status = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await query(
      `SELECT lb.*,
              l.title AS listing_title,
              l.price_cents AS listing_price_cents,
              l.image_url AS listing_image_url,
              u.id AS seller_id,
              u.name AS seller_name
       FROM listing_bids lb
       INNER JOIN listings l ON l.id = lb.listing_id
       LEFT JOIN users u ON u.id = l.user_id
       ${whereClause}
       ORDER BY lb.created_at DESC
       LIMIT 200`,
      params
    );

    return res.json(result.rows.map(toApi));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { listingId, amountCents, bidderPhone, message } = req.body;
    const parsedAmount = parseAmountCents(amountCents);

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: "Bid amount must be greater than zero" });
    }

    // Bidder identity comes from the signed-in account, not the request body, so
    // a winner can later be matched to their login.
    const bidderResult = await query("SELECT name, email, phone FROM users WHERE id = $1", [req.user.id]);
    if (bidderResult.rowCount === 0) {
      return res.status(401).json({ error: "Account not found" });
    }
    const account = bidderResult.rows[0];
    const bidderName = account.name || account.email;
    const bidderEmail = account.email;
    const resolvedPhone = (bidderPhone && String(bidderPhone).trim()) || account.phone || null;

    // Lock the listing row so two simultaneous bids can't both clear the same
    // minimum and tie for the lead.
    const outcome = await withTransaction(async (client) => {
      const listingResult = await client.query(
        `SELECT l.*,
                u.name AS seller_name,
                u.email AS seller_email,
                u.phone AS seller_phone
         FROM listings l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.id = $1
         FOR UPDATE OF l`,
        [listingId]
      );
      if (listingResult.rowCount === 0) {
        return { status: 404, error: "Listing not found" };
      }
      const listing = listingResult.rows[0];

      if (listing.status !== "active") {
        return { status: 400, error: "Bids can only be placed on active listings" };
      }
      if (req.user?.id && listing.user_id === req.user.id) {
        return { status: 400, error: "You cannot bid on your own listing" };
      }

      if (listing.is_auction) {
        if (listing.auction_ends_at && new Date(listing.auction_ends_at) <= new Date()) {
          return { status: 400, error: "This auction has ended" };
        }
        const highResult = await client.query(
          `SELECT COALESCE(MAX(amount_cents), 0) AS high
           FROM listing_bids
           WHERE listing_id = $1 AND status IN ('pending', 'accepted')`,
          [listingId]
        );
        const high = Number(highResult.rows[0].high || 0);
        const minRequired = minNextBidCents(listing, high);
        if (parsedAmount < minRequired) {
          return {
            status: 400,
            error: `Bid must be at least KES ${(minRequired / 100).toLocaleString()}`,
            minRequiredCents: minRequired,
            highestBidCents: high,
          };
        }
      }

      const inserted = await client.query(
        `INSERT INTO listing_bids
         (listing_id, user_id, bidder_name, bidder_email, bidder_phone, amount_cents, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          listingId,
          req.user.id,
          String(bidderName).trim(),
          bidderEmail ? String(bidderEmail).trim() : null,
          resolvedPhone,
          parsedAmount,
          message ? String(message).trim() : null,
        ]
      );
      return { status: 201, bid: inserted.rows[0], listing };
    });

    if (outcome.status !== 201) {
      const body = { error: outcome.error };
      if (outcome.minRequiredCents != null) {
        body.minRequiredCents = outcome.minRequiredCents;
        body.highestBidCents = outcome.highestBidCents;
      }
      return res.status(outcome.status).json(body);
    }

    const { bid, listing } = outcome;
    try {
      await sendListingBidEmail({
        to: listing.seller_email || null,
        sellerName: listing.seller_name || "Seller",
        listingTitle: listing.title,
        askingPriceCents: listing.price_cents,
        bid,
      });
      await sendListingBidMessage({
        phone: listing.seller_phone || null,
        listingTitle: listing.title,
        amountCents: parsedAmount,
        bidderName,
        bidderPhone: resolvedPhone,
      });
    } catch (error) {
      console.warn("Bid notification failed:", error);
    }

    return res.status(201).json(toApi({ ...bid, listing_title: listing.title, listing_price_cents: listing.price_cents }));
  } catch (error) {
    return next(error);
  }
});

// Public bid summary for a listing (highest bid, count, next minimum, countdown).
router.get("/listing/:listingId/summary", async (req, res, next) => {
  try {
    const fetchSummary = () =>
      query(
        `SELECT l.id, l.status, l.is_auction, l.auction_ends_at, l.price_cents,
                l.min_bid_increment_cents, l.winning_bid_id,
                COALESCE((SELECT MAX(amount_cents) FROM listing_bids
                          WHERE listing_id = l.id AND status IN ('pending', 'accepted')), 0) AS highest,
                COALESCE((SELECT COUNT(*) FROM listing_bids WHERE listing_id = l.id), 0) AS cnt
         FROM listings l
         WHERE l.id = $1`,
        [req.params.listingId]
      );

    let result = await fetchSummary();
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    let row = result.rows[0];

    // Resolve the auction now if its time is up, so pollers see the final state.
    if (row.is_auction && row.status === "active" && row.auction_ends_at && new Date(row.auction_ends_at) <= new Date()) {
      await closeAuctionById(req.params.listingId).catch(() => undefined);
      result = await fetchSummary();
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }
      row = result.rows[0];
    }

    const high = Number(row.highest || 0);
    return res.json({
      listingId: row.id,
      status: row.status,
      isAuction: row.is_auction ?? false,
      auctionEndsAt: row.auction_ends_at || null,
      priceCents: Number(row.price_cents || 0),
      highestBidCents: high,
      bidCount: Number(row.cnt || 0),
      minBidIncrementCents: row.min_bid_increment_cents == null ? null : Number(row.min_bid_increment_cents),
      minNextBidCents: minNextBidCents(row, high),
      winningBidId: row.winning_bid_id || null,
    });
  } catch (error) {
    return next(error);
  }
});

// The signed-in user's outcome for an auction. Only reveals seller contact
// details to the winning bidder so they can arrange payment offline.
router.get("/listing/:listingId/my-result", requireAuth, async (req, res, next) => {
  try {
    // Resolve the auction first if its timer has elapsed.
    const pre = await query(
      "SELECT id, is_auction, status, auction_ends_at FROM listings WHERE id = $1",
      [req.params.listingId]
    );
    if (pre.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    const preRow = pre.rows[0];
    if (
      preRow.is_auction &&
      preRow.status === "active" &&
      preRow.auction_ends_at &&
      new Date(preRow.auction_ends_at) <= new Date()
    ) {
      await closeAuctionById(req.params.listingId).catch(() => undefined);
    }

    const result = await query(
      `SELECT l.id, l.title, l.is_auction, l.status, l.auction_ends_at, l.winning_bid_id,
              lb.id AS bid_id, lb.amount_cents, lb.status AS bid_status,
              u.name AS seller_name, u.email AS seller_email, u.phone AS seller_phone
       FROM listings l
       LEFT JOIN listing_bids lb ON lb.id = l.winning_bid_id
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.id = $1`,
      [req.params.listingId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    const row = result.rows[0];
    const ended =
      row.is_auction &&
      (row.status !== "active" || (row.auction_ends_at && new Date(row.auction_ends_at) <= new Date()));

    // Did this user place the winning bid?
    let won = false;
    if (ended && row.winning_bid_id) {
      const winnerCheck = await query(
        "SELECT user_id FROM listing_bids WHERE id = $1",
        [row.winning_bid_id]
      );
      won = winnerCheck.rowCount > 0 && winnerCheck.rows[0].user_id === req.user.id;
    }

    return res.json({
      listingId: row.id,
      isAuction: row.is_auction ?? false,
      ended: Boolean(ended),
      won,
      amountCents: won ? Number(row.amount_cents || 0) : null,
      seller: won
        ? {
            name: row.seller_name || null,
            email: row.seller_email || null,
            phone: row.seller_phone || null,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const bidResult = await query(
      `SELECT lb.id, l.user_id AS seller_id
       FROM listing_bids lb
       INNER JOIN listings l ON l.id = lb.listing_id
       WHERE lb.id = $1`,
      [req.params.id]
    );
    if (bidResult.rowCount === 0) {
      return res.status(404).json({ error: "Bid not found" });
    }
    if (req.user.role !== "admin" && bidResult.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const handledAt = status === "pending" ? null : new Date().toISOString();
    const result = await query(
      `UPDATE listing_bids
       SET status = $1, handled_at = $2
       WHERE id = $3
       RETURNING *`,
      [status, handledAt, req.params.id]
    );

    return res.json(toApi(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

export default router;
