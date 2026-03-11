import { query } from "./db.js";
import { sendAdminDigestEmail, sendSellerDigestEmail } from "./email.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

const getUtcDateLabel = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date());

const claimDigestRun = async (digestKind, runDate) => {
  const result = await query(
    `INSERT INTO digest_runs (digest_kind, run_date)
     VALUES ($1, $2)
     ON CONFLICT (digest_kind, run_date) DO NOTHING
     RETURNING id`,
    [digestKind, runDate]
  );
  return result.rowCount > 0;
};

const getAdminDigestData = async () => {
  const [summaryResult, topRiskResult, topViewedResult] = await Promise.all([
    query(
      `SELECT
          COUNT(*)::int AS total_listings,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
          COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_listings,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_listings,
          COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_listings,
          COUNT(*) FILTER (WHERE risk_score >= 50)::int AS high_risk_listings,
          COALESCE(AVG(risk_score), 0)::float AS average_risk_score,
          COALESCE((SELECT COUNT(*) FROM listing_views), 0)::int AS total_views,
          COALESCE((SELECT COUNT(*) FROM inquiries), 0)::int AS total_inquiries,
          COALESCE((SELECT COUNT(*) FROM bookings), 0)::int AS total_bookings,
          COALESCE((SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'), 0)::int AS confirmed_bookings,
          COALESCE((SELECT COUNT(*) FROM users WHERE seller_verification_status = 'verified'), 0)::int AS verified_sellers
       FROM listings`
    ),
    query(
      `SELECT l.title, l.status, l.risk_score, u.name AS seller_name
       FROM listings l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.risk_score DESC, l.updated_at DESC
       LIMIT 5`
    ),
    query(
      `SELECT
          l.title,
          COUNT(lv.id)::int AS views_count,
          COUNT(DISTINCT i.id)::int AS inquiries_count
       FROM listings l
       LEFT JOIN listing_views lv ON lv.listing_id = l.id
       LEFT JOIN inquiries i ON i.listing_id = l.id
       GROUP BY l.id
       ORDER BY COUNT(lv.id) DESC, COUNT(DISTINCT i.id) DESC, l.updated_at DESC
       LIMIT 5`
    ),
  ]);

  const summary = summaryResult.rows[0] || {};
  const totalViews = Number(summary.total_views || 0);
  const totalInquiries = Number(summary.total_inquiries || 0);
  const confirmedBookings = Number(summary.confirmed_bookings || 0);

  return {
    summary: {
      activeListings: Number(summary.active_listings || 0),
      pendingListings: Number(summary.pending_listings || 0),
      rejectedListings: Number(summary.rejected_listings || 0),
      highRiskListings: Number(summary.high_risk_listings || 0),
      totalViews,
      totalInquiries,
      confirmedBookings,
      verifiedSellers: Number(summary.verified_sellers || 0),
      viewToInquiryRate: totalViews > 0 ? Number(((totalInquiries / totalViews) * 100).toFixed(1)) : 0,
      inquiryToConfirmedRate:
        totalInquiries > 0 ? Number(((confirmedBookings / totalInquiries) * 100).toFixed(1)) : 0,
    },
    topRiskListings: topRiskResult.rows.map((row) => ({
      title: row.title,
      status: row.status,
      riskScore: Number(row.risk_score || 0),
      sellerName: row.seller_name || "Seller",
    })),
    topViewedListings: topViewedResult.rows.map((row) => ({
      title: row.title,
      viewsCount: Number(row.views_count || 0),
      inquiriesCount: Number(row.inquiries_count || 0),
    })),
  };
};

const getSellerDigestData = async (userId) => {
  const [summaryResult, topListingsResult] = await Promise.all([
    query(
      `SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_listings,
          COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending_listings,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_listings,
          COALESCE(AVG(risk_score), 0)::float AS average_risk_score,
          COALESCE((
            SELECT COUNT(*)
            FROM listing_views lv
            INNER JOIN listings lx ON lx.id = lv.listing_id
            WHERE lx.user_id = $1
          ), 0)::int AS total_views,
          COALESCE((
            SELECT COUNT(*)
            FROM inquiries i
            INNER JOIN listings li ON li.id = i.listing_id
            WHERE li.user_id = $1
          ), 0)::int AS total_inquiries,
          COALESCE((
            SELECT COUNT(*)
            FROM bookings b
            INNER JOIN listings lb ON lb.id = b.listing_id
            WHERE lb.user_id = $1 AND b.status = 'confirmed'
          ), 0)::int AS confirmed_bookings
       FROM listings
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT
          l.title,
          COUNT(DISTINCT lv.id)::int AS views_count,
          COUNT(DISTINCT i.id)::int AS inquiries_count,
          COUNT(DISTINCT b.id)::int AS bookings_count
       FROM listings l
       LEFT JOIN listing_views lv ON lv.listing_id = l.id
       LEFT JOIN inquiries i ON i.listing_id = l.id
       LEFT JOIN bookings b ON b.listing_id = l.id
       WHERE l.user_id = $1
       GROUP BY l.id
       ORDER BY COUNT(DISTINCT lv.id) DESC, COUNT(DISTINCT i.id) DESC, l.updated_at DESC
       LIMIT 5`,
      [userId]
    ),
  ]);

  const summary = summaryResult.rows[0] || {};
  const totalViews = Number(summary.total_views || 0);
  const totalInquiries = Number(summary.total_inquiries || 0);
  const confirmedBookings = Number(summary.confirmed_bookings || 0);

  return {
    summary: {
      activeListings: Number(summary.active_listings || 0),
      pendingListings: Number(summary.pending_listings || 0),
      rejectedListings: Number(summary.rejected_listings || 0),
      totalViews,
      totalInquiries,
      confirmedBookings,
      averageRiskScore: Number(Number(summary.average_risk_score || 0).toFixed(1)),
      viewToInquiryRate: totalViews > 0 ? Number(((totalInquiries / totalViews) * 100).toFixed(1)) : 0,
      inquiryToConfirmedRate:
        totalInquiries > 0 ? Number(((confirmedBookings / totalInquiries) * 100).toFixed(1)) : 0,
    },
    topListings: topListingsResult.rows.map((row) => ({
      title: row.title,
      viewsCount: Number(row.views_count || 0),
      inquiriesCount: Number(row.inquiries_count || 0),
      bookingsCount: Number(row.bookings_count || 0),
    })),
  };
};

export const runAdminDigest = async () => {
  const to = process.env.ADMIN_DIGEST_EMAIL || process.env.INQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!to) return false;

  const data = await getAdminDigestData();
  return sendAdminDigestEmail({
    to,
    dateLabel: getUtcDateLabel(),
    summary: data.summary,
    topRiskListings: data.topRiskListings,
    topViewedListings: data.topViewedListings,
  });
};

export const runSellerDigests = async () => {
  const sellersResult = await query(
    `SELECT id, name, email
     FROM users
     WHERE email IS NOT NULL
       AND EXISTS (SELECT 1 FROM listings WHERE user_id = users.id)`,
    []
  );

  let sentCount = 0;
  for (const seller of sellersResult.rows) {
    const data = await getSellerDigestData(seller.id);
    const hasActivity =
      data.summary.activeListings > 0 ||
      data.summary.pendingListings > 0 ||
      data.summary.totalViews > 0 ||
      data.summary.totalInquiries > 0;
    if (!hasActivity) continue;

    const sent = await sendSellerDigestEmail({
      to: seller.email,
      sellerName: seller.name,
      dateLabel: getUtcDateLabel(),
      summary: data.summary,
      topListings: data.topListings,
    });
    if (sent) sentCount += 1;
  }

  return sentCount;
};

const shouldRunNow = () => {
  const enabled = process.env.DIGESTS_ENABLED === "true";
  if (!enabled) return false;

  const targetHour = Number(process.env.DIGESTS_HOUR_UTC || 6);
  const now = new Date();
  return now.getUTCHours() === targetHour && now.getUTCMinutes() < 15;
};

const getRunDate = () => new Date().toISOString().slice(0, 10);

export const startDigestScheduler = () => {
  if (process.env.DIGESTS_ENABLED !== "true") return () => {};

  const tick = async () => {
    if (!shouldRunNow()) return;

    const runDate = getRunDate();
    try {
      if (await claimDigestRun("admin_daily", runDate)) {
        await runAdminDigest();
      }
      if (await claimDigestRun("seller_daily", runDate)) {
        await runSellerDigests();
      }
    } catch (error) {
      console.error("Digest scheduler failed:", error);
    }
  };

  const intervalId = setInterval(() => {
    tick().catch((error) => console.error("Digest tick failed:", error));
  }, CHECK_INTERVAL_MS);

  tick().catch((error) => console.error("Initial digest tick failed:", error));

  return () => clearInterval(intervalId);
};
