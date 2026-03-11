const normalizePhone = (value) => {
  if (!value) return null;
  let phone = String(value).replace(/[^\d+]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  if (phone.startsWith("7") || phone.startsWith("1")) phone = `254${phone}`;
  return /^254\d{9}$/.test(phone) ? phone : null;
};

const sendViaWebhook = async ({ channel, to, message }) => {
  const webhookUrl = process.env.MESSAGING_WEBHOOK_URL;
  if (!webhookUrl || !to || !message) return false;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MESSAGING_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.MESSAGING_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      provider: process.env.MESSAGING_PROVIDER || "generic_webhook",
      channel,
      to,
      from:
        channel === "whatsapp"
          ? process.env.WHATSAPP_FROM || null
          : process.env.SMS_FROM || null,
      message,
    }),
  });

  return response.ok;
};

const maybeSend = async ({ phone, message, whatsapp = true, sms = true }) => {
  const to = normalizePhone(phone);
  if (!to || !message) return { sms: false, whatsapp: false };

  const result = { sms: false, whatsapp: false };
  try {
    if (sms) {
      result.sms = await sendViaWebhook({ channel: "sms", to, message });
    }
    if (whatsapp) {
      result.whatsapp = await sendViaWebhook({ channel: "whatsapp", to, message });
    }
  } catch (error) {
    console.warn("Messaging notification failed:", error);
  }

  return result;
};

export const sendInquiryReceiptMessage = async ({ phone, name, listingTitle }) =>
  maybeSend({
    phone,
    message: [
      `Hello ${name || "there"},`,
      "We received your inquiry on WheelsnationKe.",
      listingTitle ? `Listing: ${listingTitle}.` : null,
      "Our team or the seller will follow up shortly.",
    ]
      .filter(Boolean)
      .join(" "),
  });

export const sendListingModerationMessage = async ({
  phone,
  listingTitle,
  status,
  moderationNotes,
}) =>
  maybeSend({
    phone,
    message: [
      `WheelsnationKe listing update for "${listingTitle}".`,
      `Status: ${String(status || "pending_approval").replaceAll("_", " ")}.`,
      moderationNotes ? `Notes: ${moderationNotes}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
  });

export const sendEventTicketMessage = async ({
  phone,
  attendeeName,
  eventTitle,
  ticketCodes,
}) =>
  maybeSend({
    phone,
    message: [
      `Hello ${attendeeName || "there"},`,
      `Your ticket for ${eventTitle || "your event"} is confirmed.`,
      ticketCodes.length > 0 ? `Codes: ${ticketCodes.join(", ")}.` : null,
      "Download the full ticket from your WheelsnationKe account.",
    ]
      .filter(Boolean)
      .join(" "),
  });

export { normalizePhone };
