import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CryptoPaymentTimeline from "@/components/shared/CryptoPaymentTimeline";
import DatePickerField from "@/components/shared/DatePickerField";
import useCryptoPaymentStatus from "@/hooks/useCryptoPaymentStatus";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadCsv, toCsv } from "@/lib/csv";
import { toDateInputValue } from "@/lib/date";
import { dataUrlToFormat, fetchBrandLogoDataUrl } from "@/lib/pdfBranding";
import { jsPDF } from "jspdf";

type CryptoSourceKind = "order" | "booking" | "event_registration";

type CryptoPaymentItem = {
  kind: CryptoSourceKind;
  id: string;
  title: string;
  subtitle: string;
  amountCents: number;
  paymentMethod: string | null;
  paymentStatus: "unpaid" | "pending" | "paid" | "failed";
  cryptoReviewNotes: string | null;
  createdAt: string;
};

type PaymentFilter = "all" | "mpesa" | "crypto";
type StatusFilter = "all" | "pending" | "paid" | "failed" | "unpaid";

const money = (cents: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const paymentStatusTone = (status: CryptoPaymentItem["paymentStatus"]) => {
  switch (status) {
    case "paid":
      return "default";
    case "pending":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

const paymentMethodTone = (method: string | null) => {
  if (method === "crypto") return "secondary";
  if (method === "mpesa") return "default";
  if (method === "bank") return "outline";
  return "outline";
};

const MyCryptoPayments = () => {
  const { token } = useAuth();
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const [items, setItems] = useState<CryptoPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CryptoPaymentItem | null>(null);
  const selectedDialogRef = useRef<HTMLDivElement | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState<string | null>(null);
  const [createdTo, setCreatedTo] = useState<string | null>(null);

  const selectedStatusPath = useMemo(() => {
    if (!selectedItem) return null;
    switch (selectedItem.kind) {
      case "order":
        return `/api/payments/crypto/status/${selectedItem.id}`;
      case "booking":
        return `/api/payments/crypto/booking-status/${selectedItem.id}`;
      case "event_registration":
        return `/api/payments/crypto/event-registration-status/${selectedItem.id}`;
      default:
        return null;
    }
  }, [selectedItem]);

  const {
    data: cryptoStatusData,
    loading: cryptoStatusLoading,
    error: cryptoStatusError,
    refresh: refreshCryptoStatus,
  } = useCryptoPaymentStatus(selectedStatusPath, Boolean(selectedItem), 5000, authHeaders);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const parse = (kind: CryptoSourceKind, record: Record<string, unknown>) => {
      const paymentMethod = String(record.paymentMethod || record.payment_method || "").trim() || null;
      const paymentStatus = String(record.paymentStatus || record.payment_status || "unpaid") as CryptoPaymentItem["paymentStatus"];
      if (!paymentMethod) return null;

      const title =
        kind === "order"
          ? `Order ${String(record.id || "").slice(0, 8)}`
          : kind === "booking"
            ? String(record.listingTitle || record.listing_title || `Booking ${String(record.id || "").slice(0, 8)}`)
            : String(record.eventTitle || record.event_title || `Event registration ${String(record.id || "").slice(0, 8)}`);

      const subtitle =
        kind === "order"
          ? `${Number(record.itemsCount || record.items_count || 0)} items`
          : kind === "booking"
            ? `${record.startDate || record.start_date || "--"} to ${record.endDate || record.end_date || "--"}`
            : `${Number(record.tickets || 1)} ticket${Number(record.tickets || 1) === 1 ? "" : "s"}`;

      return {
        kind,
        id: String(record.id || ""),
        title,
        subtitle,
        amountCents: Number(record.totalCents || record.total_cents || record.amountCents || record.amount_cents || 0),
        paymentMethod,
        paymentStatus,
        cryptoReviewNotes: String(record.cryptoReviewNotes || record.crypto_review_notes || "") || null,
        createdAt: String(record.createdAt || record.created_at || ""),
      } satisfies CryptoPaymentItem;
    };

    const endpoints: Array<[CryptoSourceKind, string]> = [
      ["order", "/api/orders"],
      ["booking", "/api/bookings"],
      ["event_registration", "/api/event-registrations"],
    ];

    const results = await Promise.allSettled(
      endpoints.map(async ([kind, endpoint]) => {
        const resp = await apiFetch(endpoint, { headers: authHeaders });
        if (!resp.ok) {
          throw new Error(`Failed to load ${kind.replaceAll("_", " ")} payments`);
        }
        const data = (await resp.json()) as Record<string, unknown>[];
        return data.map((record) => parse(kind, record)).filter(Boolean) as CryptoPaymentItem[];
      })
    );

    const nextItems = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const errors = results.filter((result) => result.status === "rejected");

    setItems(nextItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    if (errors.length > 0) {
      const message = errors.map((item) => (item.status === "rejected" ? item.reason?.message || "Load failed" : "")).filter(Boolean).join(" • ");
      setError(message || "Some crypto payments could not be loaded.");
      toast.error(message || "Some crypto payments could not be loaded.");
    }
    setLoading(false);
  }, [authHeaders, token]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const pendingCount = items.filter((item) => item.paymentStatus === "pending").length;
  const approvedCount = items.filter((item) => item.paymentStatus === "paid").length;
  const rejectedCount = items.filter((item) => item.paymentStatus === "failed").length;
  const cryptoCount = items.filter((item) => item.paymentMethod === "crypto").length;
  const mpesaCount = items.filter((item) => item.paymentMethod === "mpesa").length;
  const filteredItems = items.filter((item) => {
    const matchesPayment = paymentFilter === "all" ? true : item.paymentMethod === paymentFilter;
    const matchesStatus = statusFilter === "all" ? true : item.paymentStatus === statusFilter;
    const createdDate = toDateInputValue(new Date(item.createdAt));
    const matchesCreatedFrom = createdFrom ? createdDate >= createdFrom : true;
    const matchesCreatedTo = createdTo ? createdDate <= createdTo : true;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      ? true
      : [item.title, item.subtitle, item.paymentMethod, item.paymentStatus, item.cryptoReviewNotes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
    return matchesPayment && matchesStatus && matchesCreatedFrom && matchesCreatedTo && matchesSearch;
  });

  const exportCsv = () => {
    const csv = toCsv(
      filteredItems.map((item) => ({
        type: item.kind.replaceAll("_", " "),
        title: item.title,
        subtitle: item.subtitle,
        payment_method: item.paymentMethod || "manual",
        status: item.paymentStatus,
        amount: item.amountCents / 100,
        notes: item.cryptoReviewNotes || "--",
        created_at: item.createdAt,
      })),
      ["type", "title", "subtitle", "payment_method", "status", "amount", "notes", "created_at"]
    );
    downloadCsv(`payments-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Payments exported.");
  };

  const exportPdf = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = 48;
    const logoDataUrl = await fetchBrandLogoDataUrl();

    const ensureSpace = (height: number) => {
      if (y + height > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    doc.setFillColor(7, 19, 27);
    doc.rect(0, 0, pageWidth, 38, "F");
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, dataUrlToFormat(logoDataUrl), margin, 6, 24, 24);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("WheelsnationKe", margin + 32, 16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Payments Center", margin + 32, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 16, { align: "right" });
    doc.text(`Records: ${filteredItems.length}`, pageWidth - margin, 28, { align: "right" });
    y = 54;
    doc.setTextColor(10, 18, 24);

    filteredItems.forEach((item, index) => {
      ensureSpace(88);
      doc.setDrawColor(210, 216, 224);
      doc.roundedRect(margin, y, contentWidth, 78, 6, 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${index + 1}. ${item.title}`, margin + 10, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Type: ${item.kind.replaceAll("_", " ")}`, margin + 10, y + 34);
      doc.text(`Method: ${item.paymentMethod || "manual"}`, margin + 10, y + 48);
      doc.text(`Status: ${item.paymentStatus}`, margin + 10, y + 62);
      doc.text(`Amount: ${money(item.amountCents)}`, margin + 220, y + 34);
      doc.text(`Created: ${new Date(item.createdAt).toLocaleString()}`, margin + 220, y + 48);
      const noteLines = doc.splitTextToSize(item.cryptoReviewNotes || "No review notes yet.", contentWidth - 240);
      doc.text(noteLines, margin + 220, y + 62);
      y += 92;
    });

    doc.save(`payments-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Payments PDF downloaded.");
  };

  const printSummary = async (item: CryptoPaymentItem) => {
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) {
      toast.error("Unable to open print window.");
      return;
    }
    const logoDataUrl = await fetchBrandLogoDataUrl();
    win.document.write(`
      <html>
        <head>
          <title>Payment Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f1f2a; padding-bottom: 14px; margin-bottom: 18px; }
            .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #ddd; border-radius: 12px; background: #fff; padding: 6px; }
            h1 { margin: 0; }
            h2 { margin: 0; font-size: 18px; }
            .muted { color: #666; }
            .row { margin: 10px 0; }
            .label { font-weight: bold; display: inline-block; min-width: 160px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-top: 18px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="WheelsnationKe logo" />` : ""}
            <div>
              <h1>WheelsnationKe</h1>
              <h2>Payment Summary</h2>
              <p class="muted">${item.title}</p>
            </div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Type:</span> ${item.kind.replaceAll("_", " ")}</div>
            <div class="row"><span class="label">Method:</span> ${item.paymentMethod || "manual"}</div>
            <div class="row"><span class="label">Status:</span> ${item.paymentStatus}</div>
            <div class="row"><span class="label">Amount:</span> ${money(item.amountCents)}</div>
            <div class="row"><span class="label">Details:</span> ${item.subtitle}</div>
            <div class="row"><span class="label">Notes:</span> ${item.cryptoReviewNotes || "--"}</div>
            <div class="row"><span class="label">Created:</span> ${new Date(item.createdAt).toLocaleString()}</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
    toast.success("Payment summary opened for printing.");
  };

  const printInvoice = async (item: CryptoPaymentItem) => {
    if (item.kind !== "order") {
      await printSummary(item);
      return;
    }
    try {
      const resp = await apiFetch(`/api/orders/${item.id}`, { headers: authHeaders });
      if (!resp.ok) {
        throw new Error("Failed to load order invoice");
      }
      const order = (await resp.json()) as {
        id: string;
        totalCents: number;
        status: string;
        paymentMethod: string | null;
        paymentStatus: string;
        paidAt: string | null;
        createdAt: string;
        items: Array<{
          id: string;
          name: string;
          quantity: number;
          size: string | null;
          priceCents: number;
        }>;
      };

      const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
      if (!win) {
        toast.error("Unable to open print window.");
        return;
      }
      const logoDataUrl = await fetchBrandLogoDataUrl();
      const rows = (order.items || [])
        .map(
          (line) => `
            <tr>
              <td>${line.name}</td>
              <td>${line.quantity}</td>
              <td>${line.size || "--"}</td>
              <td>${money(line.priceCents)}</td>
              <td>${money(line.priceCents * line.quantity)}</td>
            </tr>
          `
        )
        .join("");
      win.document.write(`
        <html>
          <head>
            <title>Order Invoice</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
              .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f1f2a; padding-bottom: 14px; margin-bottom: 18px; }
              .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #ddd; border-radius: 12px; background: #fff; padding: 6px; }
              h1 { margin: 0; }
              h2 { margin: 0; font-size: 18px; }
              .muted { color: #666; }
              .row { margin: 10px 0; }
              .label { font-weight: bold; display: inline-block; min-width: 160px; }
              .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-top: 18px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background: #f4f4f4; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="WheelsnationKe logo" />` : ""}
              <div>
                <h1>WheelsnationKe</h1>
                <h2>Order Invoice</h2>
                <p class="muted">Order ${order.id}</p>
              </div>
            </div>
            <div class="card">
              <div class="row"><span class="label">Status:</span> ${order.status}</div>
              <div class="row"><span class="label">Payment Method:</span> ${order.paymentMethod || "manual"}</div>
              <div class="row"><span class="label">Payment Status:</span> ${order.paymentStatus}</div>
              <div class="row"><span class="label">Paid At:</span> ${order.paidAt || "--"}</div>
              <div class="row"><span class="label">Created:</span> ${new Date(order.createdAt).toLocaleString()}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Size</th>
                  <th>Unit</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="card">
              <div class="row"><span class="label">Total:</span> ${money(order.totalCents)}</div>
            </div>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `);
      win.document.close();
      toast.success("Order invoice opened for printing.");
    } catch (error) {
      console.error(error);
      toast.error("Unable to print invoice.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pb-20 pt-28 sm:pt-32">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-primary">My Account</p>
            <h1 className="font-display text-3xl sm:text-4xl">Payments Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track your M-Pesa and crypto-backed orders, bookings, and event registrations in one place, with live review status, proof, and explorer links.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadItems()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="hero" onClick={exportCsv} disabled={filteredItems.length === 0}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => void exportPdf()} disabled={filteredItems.length === 0}>
              Download PDF
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="mt-2 text-3xl font-semibold">{items.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Crypto</p>
              <p className="mt-2 text-3xl font-semibold">{cryptoCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">M-Pesa</p>
              <p className="mt-2 text-3xl font-semibold">{mpesaCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-3xl font-semibold">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl sm:col-span-2 xl:col-span-4">
            <CardContent className="grid gap-4 p-5">
              <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by title, notes, status, or method"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">All statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={paymentFilter === "all" ? "hero" : "secondary"} size="sm" onClick={() => setPaymentFilter("all")}>
                  All
                </Button>
                <Button variant={paymentFilter === "crypto" ? "hero" : "secondary"} size="sm" onClick={() => setPaymentFilter("crypto")}>
                  Crypto
                </Button>
                <Button variant={paymentFilter === "mpesa" ? "hero" : "secondary"} size="sm" onClick={() => setPaymentFilter("mpesa")}>
                  M-Pesa
                </Button>
                <div className="ml-auto text-sm text-muted-foreground">
                  Reviewed: <span className="font-medium text-foreground">{approvedCount + rejectedCount}</span>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Created From</Label>
                  <DatePickerField
                    value={createdFrom}
                    onChange={setCreatedFrom}
                    placeholder="Any date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Created To</Label>
                  <DatePickerField
                    value={createdTo}
                    onChange={setCreatedTo}
                    placeholder="Any date"
                    minDate={createdFrom}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && items.length === 0 ? (
            <Card className="rounded-2xl md:col-span-2 xl:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">Loading crypto payments...</CardContent>
            </Card>
          ) : null}

          {!loading && items.length === 0 ? (
            <Card className="rounded-2xl md:col-span-2 xl:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No crypto payments yet. Once you submit a crypto-backed order, booking, or event registration, it will appear here.
              </CardContent>
            </Card>
          ) : null}

          {filteredItems.map((item) => (
            <Card key={`${item.kind}-${item.id}`} className="rounded-2xl">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <Badge variant={paymentStatusTone(item.paymentStatus)} className="capitalize">
                    {item.paymentStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {item.kind.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant={paymentMethodTone(item.paymentMethod)} className="capitalize">
                    {item.paymentMethod || "manual"}
                  </Badge>
                  <span>{new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(item.amountCents / 100)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.cryptoReviewNotes ? item.cryptoReviewNotes : "No review notes yet."}
                </div>
                <div className="flex gap-2">
                  {item.paymentMethod === "crypto" ? (
                    <Button variant="hero" className="w-full" onClick={() => setSelectedItem(item)}>
                      Track Crypto Payment
                    </Button>
                  ) : (
                    <div className="w-full rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                      This payment is handled by {item.paymentMethod?.toUpperCase() || "manual"} and does not use the crypto timeline.
                    </div>
                  )}
                </div>
                <Button variant="secondary" className="w-full" onClick={() => void printInvoice(item)}>
                  {item.kind === "order" ? "Print Invoice" : "Print Summary"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {!loading && items.length > 0 && filteredItems.length === 0 ? (
            <Card className="rounded-2xl md:col-span-2 xl:col-span-3">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No payments match the current filters.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>

      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Track Crypto Payment</DialogTitle>
            <DialogDescription>
              Follow the proof, blockchain explorer, and admin review timeline for this payment.
            </DialogDescription>
          </DialogHeader>
          <CryptoPaymentTimeline
            title={selectedItem ? selectedItem.title : "Crypto payment timeline"}
            description={selectedItem ? selectedItem.subtitle : undefined}
            resource={cryptoStatusData?.resource || null}
            transaction={cryptoStatusData?.transaction || null}
            loading={cryptoStatusLoading}
            error={cryptoStatusError}
            onRefresh={refreshCryptoStatus}
            refreshing={cryptoStatusLoading}
          />
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default MyCryptoPayments;
