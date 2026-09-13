import { query, withTransaction } from "./db.js";
import { sendAuctionWonEmail, sendAuctionEndedSellerEmail } from "./email.js";
import { sendListingBidMessage } from "./notifications.js";

// Default minimum increment when a seller doesn't set one: 1% of asking price,
// floored at KES 10,000 (1,000,000 cents).
export const defaultIncrementCents = (priceCents) =>
  Math.max(Math.round(Number(priceCents || 0) * 0.01), 1_000_000);

export const incrementForListing = (listing) =>
  listing.min_bid_increment_cents && Number(listing.min_bid_increment_cents) > 0
    ? Number(listing.min_bid_increment_cents)
    : defaultIncrementCents(listing.price_cents);

// Minimum a new bid must reach: opening bid must meet the asking price,
// subsequent bids must beat the current highest by the increment.
export const minNextBidCents = (listing, highestCents) =>
  Number(highestCents || 0) > 0
    ? Number(highestCents) + incrementForListing(listing)
    : Number(listing.price_cents || 0);

// Resolve a single expired auction: highest bid wins, listing marked sold,
// losing bids rejected. Returns { listing, winner } if a winner was picked.
export const closeAuctionById = async (listingId) => {
  const result = await withTransaction(async (client) => {
    const lr = await client.query(
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
    if (lr.rowCount === 0) return null;
    const listing = lr.rows[0];

    // Re-check under the lock (another worker may have closed it already).
    const ended = listing.auction_ends_at && new Date(listing.auction_ends_at) <= new Date();
    if (!listing.is_auction || listing.status !== "active" || !ended) {
      return null;
    }

    const hb = await client.query(
      `SELECT *
       FROM listing_bids
       WHERE listing_id = $1 AND status IN ('pending', 'accepted')
       ORDER BY amount_cents DESC, created_at ASC
       LIMIT 1`,
      [listingId]
    );

    if (hb.rowCount === 0) {
      // No bids — close the auction without a sale.
      await client.query(
        `UPDATE listings SET status = 'inactive', updated_at = now() WHERE id = $1`,
        [listingId]
      );
      return null;
    }

    const winner = hb.rows[0];
    await client.query(
      `UPDATE listing_bids SET status = 'accepted', handled_at = now(), updated_at = now() WHERE id = $1`,
      [winner.id]
    );
    await client.query(
      `UPDATE listing_bids
       SET status = 'rejected', handled_at = now(), updated_at = now()
       WHERE listing_id = $1 AND id <> $2 AND status <> 'rejected'`,
      [listingId, winner.id]
    );
    await client.query(
      `UPDATE listings SET status = 'sold', winning_bid_id = $2, updated_at = now() WHERE id = $1`,
      [listingId, winner.id]
    );

    return { listing, winner };
  });

  if (!result) return null;

  const { listing, winner } = result;
  try {
    await sendAuctionWonEmail({
      to: winner.bidder_email,
      bidderName: winner.bidder_name,
      listingTitle: listing.title,
      amountCents: winner.amount_cents,
      sellerName: listing.seller_name,
      sellerEmail: listing.seller_email,
      sellerPhone: listing.seller_phone,
    });
    await sendAuctionEndedSellerEmail({
      to: listing.seller_email,
      sellerName: listing.seller_name,
      listingTitle: listing.title,
      winnerName: winner.bidder_name,
      amountCents: winner.amount_cents,
      winnerEmail: winner.bidder_email,
      winnerPhone: winner.bidder_phone,
    });
    await sendListingBidMessage({
      phone: winner.bidder_phone || null,
      listingTitle: listing.title,
      amountCents: winner.amount_cents,
      bidderName: winner.bidder_name,
      bidderPhone: winner.bidder_phone,
    });
  } catch (error) {
    console.warn("Auction result notification failed:", error);
  }

  return result;
};

// Sweep all auctions whose end time has passed and resolve them.
export const closeExpiredAuctions = async () => {
  const due = await query(
    `SELECT id
     FROM listings
     WHERE is_auction = true
       AND status = 'active'
       AND auction_ends_at IS NOT NULL
       AND auction_ends_at <= now()
       AND deleted_at IS NULL
     LIMIT 100`
  );
  let closed = 0;
  for (const row of due.rows) {
    try {
      if (await closeAuctionById(row.id)) closed += 1;
    } catch (error) {
      console.warn("Failed to close auction", row.id, error);
    }
  }
  return closed;
};
