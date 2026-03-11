import { jsPDF } from "jspdf";
import { getTicketQrImageUrl, toTicketQrPayload } from "@/lib/ticketQr";

type ReceiptRegistration = {
  id: string;
  eventTitle: string | null;
  eventLocation: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  amountCents: number;
  paymentMethod: string | null;
  paymentStatus: string;
  paidAt: string | null;
  createdAt: string;
};

type ReceiptTicket = {
  id: string;
  ticketNumber: string;
  status: string;
};

const formatCurrency = (amountCents?: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);

const formatDate = (value?: string | null) => {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "TBA";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(start || end);
};

const getLogoUrl = () => `${window.location.origin}/brand/wheelsnationke-logo.png`;

const dataUrlToFormat = (dataUrl: string) => {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const fetchImageDataUrl = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
};

const drawLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(96, 108, 120);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(10, 18, 24);
  const lines = doc.splitTextToSize(value || "-", width);
  doc.text(lines, x, y + 5);
};

const buildPdfDocument = async (registration: ReceiptRegistration, tickets: ReceiptTicket[]) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const [logoDataUrl, ...qrDataUrls] = await Promise.all([
    fetchImageDataUrl(getLogoUrl()),
    ...tickets.map((ticket) => fetchImageDataUrl(getTicketQrImageUrl(ticket.ticketNumber, 240))),
  ]);

  doc.setFillColor(7, 19, 27);
  doc.rect(0, 0, pageWidth, 34, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, dataUrlToFormat(logoDataUrl), margin, 6, 20, 20);
  } else {
    doc.setDrawColor(255, 255, 255);
    doc.rect(margin, 6, 20, 20);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("WheelsnationKe", margin + 25, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Event Ticket Receipt", margin + 25, 21);
  doc.text(`Receipt: ${registration.id}`, margin + 25, 27);

  doc.setFontSize(9);
  doc.text(`Issued: ${formatDate(registration.createdAt)}`, pageWidth - margin, 14, {
    align: "right",
  });
  doc.text(`Payment: ${registration.paymentStatus}`, pageWidth - margin, 20, {
    align: "right",
  });
  doc.text(`Method: ${registration.paymentMethod || "free"}`, pageWidth - margin, 26, {
    align: "right",
  });

  let y = 42;

  doc.setFillColor(239, 244, 247);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(84, 96, 110);
  doc.text("OFFICIAL ADMISSION PASS", margin + 4, y + 6);
  doc.setFontSize(22);
  doc.setTextColor(10, 18, 24);
  doc.text(registration.eventTitle || "Event", margin + 4, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${registration.eventLocation || "TBA"} | ${formatDateRange(
      registration.eventStartDate,
      registration.eventEndDate
    )}`,
    margin + 4,
    y + 23
  );

  y += 34;

  const colGap = 6;
  const boxWidth = (contentWidth - colGap) / 2;
  const boxHeight = 24;
  const rowGap = 4;

  doc.setDrawColor(212, 219, 227);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2);
  drawLabelValue(doc, "Attendee", registration.contactName || "Guest", margin + 4, y + 6, boxWidth - 8);
  doc.setFontSize(10);
  doc.setTextColor(96, 108, 120);
  doc.text(registration.contactPhone || "No phone", margin + 4, y + 18);

  doc.roundedRect(margin + boxWidth + colGap, y, boxWidth, boxHeight, 2, 2);
  drawLabelValue(
    doc,
    "Amount Paid",
    formatCurrency(registration.amountCents),
    margin + boxWidth + colGap + 4,
    y + 6,
    boxWidth - 8
  );
  doc.setFontSize(10);
  doc.setTextColor(96, 108, 120);
  doc.text(
    `Paid At: ${formatDate(registration.paidAt || registration.createdAt)}`,
    margin + boxWidth + colGap + 4,
    y + 18
  );

  y += boxHeight + rowGap;

  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2);
  drawLabelValue(
    doc,
    "Schedule",
    formatDateRange(registration.eventStartDate, registration.eventEndDate),
    margin + 4,
    y + 6,
    boxWidth - 8
  );

  doc.roundedRect(margin + boxWidth + colGap, y, boxWidth, boxHeight, 2, 2);
  drawLabelValue(
    doc,
    "Ticket Count",
    `${registration.tickets} ticket${registration.tickets === 1 ? "" : "s"}`,
    margin + boxWidth + colGap + 4,
    y + 6,
    boxWidth - 8
  );

  y += boxHeight + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(10, 18, 24);
  doc.text("Ticket Stubs", margin, y);
  y += 6;

  tickets.forEach((ticket, index) => {
    if (y > pageHeight - 82) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(8, 16, 24);
    doc.roundedRect(margin, y, contentWidth, 58, 2, 2);
    doc.setDrawColor(120, 129, 138);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(pageWidth - 60, y, pageWidth - 60, y + 58);
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(96, 108, 120);
    doc.text("ADMIT ONE", margin + 4, y + 7);

    doc.setFontSize(17);
    doc.setTextColor(10, 18, 24);
    doc.text(registration.eventTitle || "Event", margin + 4, y + 15);

    doc.setFillColor(8, 16, 24);
    doc.roundedRect(pageWidth - 91, y + 4, 20, 7, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(String(ticket.status || "issued").toUpperCase(), pageWidth - 81, y + 8.7, {
      align: "center",
    });

    doc.setTextColor(10, 18, 24);
    drawLabelValue(doc, "Ticket Number", ticket.ticketNumber, margin + 4, y + 23, 62);
    drawLabelValue(doc, "Venue", registration.eventLocation || "TBA", margin + 72, y + 23, 42);
    drawLabelValue(
      doc,
      "Schedule",
      formatDateRange(registration.eventStartDate, registration.eventEndDate),
      margin + 4,
      y + 37,
      62
    );
    drawLabelValue(doc, "Attendee", registration.contactName || "Guest", margin + 72, y + 37, 42);

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(96, 108, 120);
    const payloadLines = doc.splitTextToSize(toTicketQrPayload(ticket.ticketNumber), 104);
    doc.text(payloadLines, margin + 4, y + 53);

    const qrDataUrl = qrDataUrls[index];
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, dataUrlToFormat(qrDataUrl), pageWidth - 53, y + 9, 32, 32);
    } else {
      doc.roundedRect(pageWidth - 53, y + 9, 32, 32, 1.5, 1.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("QR unavailable", pageWidth - 37, y + 26, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(96, 108, 120);
    doc.text("SCAN AT ENTRY", pageWidth - 37, y + 46, { align: "center" });

    y += 64;
  });

  if (y > pageHeight - 35) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(212, 219, 227);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(96, 108, 120);
  doc.text("TERMS", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(10, 18, 24);
  const terms = [
    "Non-transferable unless approved by the event organizer.",
    "Present this ticket with the QR code intact at entry.",
    "Valid identification may be required for verification.",
    "Cancelled registrations or failed payments invalidate this receipt.",
  ];
  doc.text(terms.map((term) => `- ${term}`), margin + 4, y + 12);

  return doc;
};

export const printEventReceipt = async (
  registration: ReceiptRegistration,
  tickets: ReceiptTicket[]
) => {
  const doc = await buildPdfDocument(registration, tickets);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
};

export const downloadEventReceipt = async (
  registration: ReceiptRegistration,
  tickets: ReceiptTicket[]
) => {
  const doc = await buildPdfDocument(registration, tickets);
  doc.save(`wheelsnationke-ticket-${registration.id.slice(0, 8)}.pdf`);
};
