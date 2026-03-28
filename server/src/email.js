import nodemailer from "nodemailer";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
};

const getDefaultFrom = () => process.env.SMTP_FROM || "no-reply@wheelsnationke.local";

const sendMail = async ({ to, subject, text, replyTo }) => {
  const transport = getTransporter();
  if (!transport || !to) return false;

  await transport.sendMail({
    from: getDefaultFrom(),
    to,
    subject,
    text,
    replyTo: replyTo || undefined,
  });

  return true;
};

export const sendInquiryEmail = async (inquiry, listingTitle) => {
  const transport = getTransporter();
  if (!transport) return false;

  const to = process.env.INQUIRY_NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!to) return false;

  const subject = `New Inquiry (${inquiry.inquiryType})`;
  const lines = [
    `Name: ${inquiry.name || "N/A"}`,
    `Email: ${inquiry.email || "N/A"}`,
    `Phone: ${inquiry.phone || "N/A"}`,
    `Type: ${inquiry.inquiryType}`,
    listingTitle ? `Listing: ${listingTitle}` : null,
    "",
    inquiry.message || "",
  ].filter(Boolean);

  await transport.sendMail({
    from: getDefaultFrom(),
    to,
    subject,
    text: lines.join("\n"),
    replyTo: inquiry.email || undefined,
  });

  return true;
};

export const sendListingInquiryEmail = async ({ to, inquiry, listingTitle, sellerName }) => {
  if (!to) return false;

  const lines = [
    `Hello ${sellerName || "Seller"},`,
    "",
    `You received a new inquiry${listingTitle ? ` for "${listingTitle}"` : ""}.`,
    "",
    `Name: ${inquiry.name || "N/A"}`,
    `Email: ${inquiry.email || "N/A"}`,
    `Phone: ${inquiry.phone || "N/A"}`,
    "",
    "Message:",
    inquiry.message || "",
    "",
    "Reply promptly through your configured contact process.",
  ];

  return sendMail({
    to,
    subject: listingTitle ? `New inquiry for ${listingTitle}` : "New listing inquiry",
    text: lines.join("\n"),
    replyTo: inquiry.email || undefined,
  });
};

export const sendInquiryReceiptEmail = async ({ to, name, listingTitle }) => {
  if (!to) return false;

  const lines = [
    `Hello ${name || "there"},`,
    "",
    "We received your inquiry on WheelsnationKe.",
    listingTitle ? `Listing: ${listingTitle}` : null,
    "",
    "Our team or the seller will follow up using the contact details you provided.",
    "",
    "If you did not make this inquiry, please ignore this email.",
  ].filter(Boolean);

  return sendMail({
    to,
    subject: listingTitle ? `Inquiry received for ${listingTitle}` : "Inquiry received",
    text: lines.join("\n"),
  });
};

export const sendListingModerationEmail = async ({
  to,
  sellerName,
  listingTitle,
  status,
  moderationNotes,
}) => {
  if (!to) return false;

  const statusLabel = String(status || "pending_approval").replaceAll("_", " ");
  const lines = [
    `Hello ${sellerName || "Seller"},`,
    "",
    `Your listing "${listingTitle}" has been reviewed.`,
    `Current status: ${statusLabel}`,
    moderationNotes ? `Moderator notes: ${moderationNotes}` : null,
    "",
    status === "active"
      ? "Your listing is now live on WheelsnationKe."
      : "Review the notes, update the listing if needed, and resubmit it for approval.",
  ].filter(Boolean);

  return sendMail({
    to,
    subject: `Listing review update: ${listingTitle}`,
    text: lines.join("\n"),
  });
};

export const sendEventTicketEmail = async ({
  to,
  attendeeName,
  registration,
  event,
  tickets,
}) => {
  if (!to) return false;

  const lines = [
    `Hello ${attendeeName || "there"},`,
    "",
    `Your event registration for "${event.title || "Event"}" is confirmed.`,
    event.location ? `Location: ${event.location}` : null,
    event.startDate ? `Start: ${event.startDate}` : null,
    event.endDate ? `End: ${event.endDate}` : null,
    `Tickets: ${registration.tickets}`,
    registration.paymentMethod ? `Payment method: ${registration.paymentMethod}` : null,
    registration.paymentStatus ? `Payment status: ${registration.paymentStatus}` : null,
    "",
    "Ticket codes:",
    ...tickets.map((ticket) => `- ${ticket.ticketNumber || ticket.ticket_number}`),
    "",
    "You can also access and download your ticket from your WheelsnationKe account.",
  ].filter(Boolean);

  return sendMail({
    to,
    subject: `Your WheelsnationKe tickets for ${event.title || "your event"}`,
    text: lines.join("\n"),
  });
};

export const sendAdminDigestEmail = async ({ to, dateLabel, summary, topRiskListings, topViewedListings }) => {
  if (!to) return false;

  const lines = [
    `WheelsnationKe admin digest for ${dateLabel}`,
    "",
    `Live listings: ${summary.activeListings}`,
    `Pending review: ${summary.pendingListings}`,
    `Rejected listings: ${summary.rejectedListings}`,
    `High-risk listings: ${summary.highRiskListings}`,
    `Total views: ${summary.totalViews}`,
    `Total inquiries: ${summary.totalInquiries}`,
    `Confirmed bookings: ${summary.confirmedBookings}`,
    `Verified sellers: ${summary.verifiedSellers}`,
    `View-to-inquiry rate: ${summary.viewToInquiryRate}%`,
    `Inquiry-to-confirmed rate: ${summary.inquiryToConfirmedRate}%`,
    "",
    "Top risk listings:",
    ...(topRiskListings.length > 0
      ? topRiskListings.map(
          (listing) =>
            `- ${listing.title} (${listing.status}, risk ${listing.riskScore}/100, seller ${listing.sellerName})`
        )
      : ["- None"]),
    "",
    "Top viewed listings:",
    ...(topViewedListings.length > 0
      ? topViewedListings.map(
          (listing) =>
            `- ${listing.title} (${listing.viewsCount} views, ${listing.inquiriesCount} inquiries)`
        )
      : ["- None"]),
  ];

  return sendMail({
    to,
    subject: `WheelsnationKe Admin Digest - ${dateLabel}`,
    text: lines.join("\n"),
  });
};

export const sendSellerDigestEmail = async ({ to, sellerName, dateLabel, summary, topListings }) => {
  if (!to) return false;

  const lines = [
    `Hello ${sellerName || "Seller"},`,
    "",
    `Here is your WheelsnationKe seller digest for ${dateLabel}.`,
    "",
    `Live listings: ${summary.activeListings}`,
    `Pending review: ${summary.pendingListings}`,
    `Rejected listings: ${summary.rejectedListings}`,
    `Views: ${summary.totalViews}`,
    `Inquiries: ${summary.totalInquiries}`,
    `Confirmed bookings: ${summary.confirmedBookings}`,
    `View-to-inquiry rate: ${summary.viewToInquiryRate}%`,
    `Inquiry-to-confirmed rate: ${summary.inquiryToConfirmedRate}%`,
    `Average risk score: ${summary.averageRiskScore}`,
    "",
    "Top listing activity:",
    ...(topListings.length > 0
      ? topListings.map(
          (listing) =>
            `- ${listing.title} (${listing.viewsCount} views, ${listing.inquiriesCount} inquiries, ${listing.bookingsCount} bookings)`
        )
      : ["- No listing activity yet"]),
    "",
    "Review pending or rejected listings promptly to improve response and conversion.",
  ];

  return sendMail({
    to,
    subject: `Your WheelsnationKe Seller Digest - ${dateLabel}`,
    text: lines.join("\n"),
  });
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  if (!to || !resetUrl) return false;

  const lines = [
    `Hello ${name || "there"},`,
    "",
    "We received a request to reset your WheelsnationKe password.",
    "Open the link below to choose a new password:",
    resetUrl,
    "",
    "This link expires in 1 hour.",
    "If you did not request a password reset, you can ignore this email.",
  ];

  return sendMail({
    to,
    subject: "Reset your WheelsnationKe password",
    text: lines.join("\n"),
  });
};
