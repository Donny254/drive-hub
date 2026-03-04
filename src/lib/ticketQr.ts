const QR_PREFIX = "drivehub:ticket:";

export const toTicketQrPayload = (ticketNumber: string) =>
  `${QR_PREFIX}${String(ticketNumber || "").trim().toUpperCase()}`;

export const parseTicketQrPayload = (raw: string) => {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (value.toLowerCase().startsWith(QR_PREFIX)) {
    const ticketNumber = value.slice(QR_PREFIX.length).trim().toUpperCase();
    return ticketNumber || null;
  }

  if (/^EVT-[A-Z0-9]+$/i.test(value)) {
    return value.toUpperCase();
  }

  return null;
};

export const getTicketQrImageUrl = (ticketNumber: string, size = 220) => {
  const payload = toTicketQrPayload(ticketNumber);
  const encoded = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
};
