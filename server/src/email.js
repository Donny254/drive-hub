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

export const sendInquiryEmail = async (inquiry, listingTitle) => {
  const transport = getTransporter();
  if (!transport) return false;

  const from = process.env.SMTP_FROM || "no-reply@wheelsnationke.local";
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
    from,
    to,
    subject,
    text: lines.join("\n"),
  });

  return true;
};
