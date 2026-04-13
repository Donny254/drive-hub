import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DatePickerField from "@/components/shared/DatePickerField";
import { dataUrlToFormat, fetchBrandLogoDataUrl } from "@/lib/pdfBranding";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv, toCsv } from "@/lib/csv";
import { toDateInputValue } from "@/lib/date";
import { jsPDF } from "jspdf";

type Payout = {
  id: string;
  bookingId: string;
  sellerId: string;
  listingId: string | null;
  listingTitle: string | null;
  buyerName: string | null;
  amountCents: number;
  feeCents: number;
  payoutAmountCents: number;
  payoutStatus: "pending" | "paid" | "failed" | "cancelled";
  payoutAt: string | null;
  notes: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  createdAt: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value / 100);

const tone = (status: Payout["payoutStatus"]) => {
  switch (status) {
    case "paid":
      return "default";
    case "pending":
      return "secondary";
    case "failed":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
};

const MyPayouts = () => {
  const { token } = useAuth();
  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Payout["payoutStatus"] | "all">("all");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/payouts/mine", { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load payouts");
      setPayouts((await resp.json()) as Payout[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load your payout history.");
      toast.error("Failed to load your payout history.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  const summary = useMemo(
    () => ({
      total: payouts.length,
      pending: payouts.filter((item) => item.payoutStatus === "pending").length,
      paid: payouts.filter((item) => item.payoutStatus === "paid").length,
      amount: payouts.reduce((sum, item) => sum + item.payoutAmountCents, 0),
    }),
    [payouts]
  );

  const filteredPayouts = useMemo(() => {
    return payouts.filter((item) => {
      const matchesStatus = statusFilter === "all" ? true : item.payoutStatus === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query
        ? true
        : [item.listingTitle, item.bookingId, item.buyerName, item.notes, item.paymentMethod, item.paymentStatus]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
      const comparedDate = toDateInputValue(new Date(item.payoutAt || item.createdAt));
      const matchesFrom = fromDate ? comparedDate >= fromDate : true;
      const matchesTo = toDate ? comparedDate <= toDate : true;
      return matchesStatus && matchesSearch && matchesFrom && matchesTo;
    });
  }, [fromDate, payouts, search, statusFilter, toDate]);

  const getBreakdown = (payout: Payout) => ({
    gross: payout.amountCents,
    commission: payout.feeCents,
    net: payout.payoutAmountCents,
  });

  const exportCsv = () => {
    const csv = toCsv(
      filteredPayouts.map((item) => ({
        listing: item.listingTitle || item.listingId || "--",
        buyer: item.buyerName || "--",
        amount: item.amountCents / 100,
        fee: item.feeCents / 100,
        payout: item.payoutAmountCents / 100,
        status: item.payoutStatus,
        payout_at: item.payoutAt || "--",
        notes: item.notes || "--",
      })),
      ["listing", "buyer", "amount", "fee", "payout", "status", "payout_at", "notes"]
    );
    downloadCsv(`payouts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Payout history exported.");
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
    doc.text("Payout Statement", margin + 32, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 16, { align: "right" });
    doc.text(`Records: ${filteredPayouts.length}`, pageWidth - margin, 28, { align: "right" });
    y = 54;
    doc.setTextColor(10, 18, 24);

    filteredPayouts.forEach((item, index) => {
      ensureSpace(88);
      doc.setDrawColor(210, 216, 224);
      doc.roundedRect(margin, y, contentWidth, 78, 6, 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${index + 1}. ${item.listingTitle || item.listingId.slice(0, 8)}`, margin + 10, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Buyer: ${item.buyerName || "--"}`, margin + 10, y + 34);
      doc.text(`Status: ${item.payoutStatus}`, margin + 10, y + 48);
      doc.text(`Gross: ${money(getBreakdown(item).gross)}`, margin + 10, y + 62);
      doc.text(`Commission: ${money(getBreakdown(item).commission)}`, margin + 220, y + 34);
      doc.text(`Net payout: ${money(getBreakdown(item).net)}`, margin + 220, y + 48);
      const noteLines = doc.splitTextToSize(item.notes || "No notes yet.", contentWidth - 240);
      doc.text(noteLines, margin + 220, y + 62);
      y += 92;
    });

    doc.save(`payouts-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Payout PDF downloaded.");
  };

  const printStatement = async () => {
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) {
      toast.error("Unable to open print window.");
      return;
    }
    const logoDataUrl = await fetchBrandLogoDataUrl();
    const rows = filteredPayouts
      .map(
        (item) => `
          <tr>
            <td>${item.listingTitle || item.listingId.slice(0, 8)}</td>
            <td>${item.buyerName || "--"}</td>
            <td>${money(item.amountCents)} / ${money(item.feeCents)}</td>
            <td>${money(item.payoutAmountCents)}</td>
            <td>${item.payoutStatus}</td>
          </tr>
        `
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Payout Statement</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f1f2a; padding-bottom: 14px; margin-bottom: 18px; }
            .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #ddd; border-radius: 12px; background: #fff; padding: 6px; }
            h1 { margin: 0; }
            h2 { margin: 0; font-size: 18px; }
            p { margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="WheelsnationKe logo" />` : ""}
            <div>
              <h1>WheelsnationKe</h1>
              <h2>Payout Statement</h2>
            </div>
          </div>
          <p>Total records: ${filteredPayouts.length} | Pending: ${filteredPayouts.filter((item) => item.payoutStatus === "pending").length} | Paid: ${filteredPayouts.filter((item) => item.payoutStatus === "paid").length}</p>
          <p>Total payout value: ${money(filteredPayouts.reduce((sum, item) => sum + item.payoutAmountCents, 0))}</p>
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Buyer</th>
                <th>Gross / Commission</th>
                <th>Payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
    toast.success("Payout statement opened for printing.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pb-20 pt-28 sm:pt-32">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-primary">My Account</p>
            <h1 className="font-display text-3xl sm:text-4xl">Payouts</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track booking payouts tied to your listings, export statements, and see what is pending or settled.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void loadPayouts()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="hero" onClick={exportCsv} disabled={filteredPayouts.length === 0}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => void exportPdf()} disabled={filteredPayouts.length === 0}>
              Download PDF
            </Button>
            <Button variant="secondary" onClick={() => void printStatement()} disabled={filteredPayouts.length === 0}>
              Print Statement
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Payout Records</p>
              <p className="mt-2 text-3xl font-semibold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-2 text-3xl font-semibold">{summary.pending}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="mt-2 text-3xl font-semibold">{summary.paid}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total Payout Value</p>
              <p className="mt-2 text-3xl font-semibold">{money(summary.amount)}</p>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : null}

        <Card className="rounded-2xl">
            <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Payout History</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6 grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Search</label>
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by listing, buyer, booking ID, notes, or method"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as Payout["payoutStatus"] | "all")}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">From</label>
                <DatePickerField value={fromDate} onChange={setFromDate} placeholder="Any date" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">To</label>
                <DatePickerField value={toDate} onChange={setToDate} placeholder="Any date" minDate={fromDate} />
              </div>
            </div>
            {loading && payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading payouts...</p>
            ) : null}
            {!loading && payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payout records yet.</p>
            ) : null}

            {!loading && filteredPayouts.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {filteredPayouts.map((payout) => (
                    <div key={payout.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{payout.listingTitle ?? payout.listingId.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Booking #{payout.bookingId.slice(0, 8)}</p>
                        </div>
                        <Badge variant={tone(payout.payoutStatus)} className="capitalize">
                          {payout.payoutStatus}
                        </Badge>
                      </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <span>Buyer</span>
                    <span className="text-right">{payout.buyerName || "--"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Gross booking value</span>
                    <span className="text-right">{money(getBreakdown(payout).gross)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Commission</span>
                    <span className="text-right">{money(getBreakdown(payout).commission)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Net payout</span>
                    <span className="text-right">{money(getBreakdown(payout).net)}</span>
                  </div>
                </div>
                      {payout.notes ? <p className="mt-3 text-xs text-muted-foreground">{payout.notes}</p> : null}
                    </div>
                  ))}
                </div>

                <div className="hidden rounded-xl border border-border md:block">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Gross / Commission</TableHead>
                      <TableHead>Net payout</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      {filteredPayouts.map((payout) => (
                        <TableRow key={payout.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.listingTitle ?? payout.listingId.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Booking #{payout.bookingId.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{payout.buyerName || "--"}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>Gross: {money(getBreakdown(payout).gross)}</p>
                        <p className="text-xs text-muted-foreground">Commission: {money(getBreakdown(payout).commission)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{money(getBreakdown(payout).net)}</TableCell>
                    <TableCell>
                      <Badge variant={tone(payout.payoutStatus)} className="capitalize">
                        {payout.payoutStatus}
                      </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : !loading && payouts.length > 0 ? (
              <div className="rounded-xl border border-border bg-background/60 p-6 text-sm text-muted-foreground">
                No payouts match the current filters.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default MyPayouts;
