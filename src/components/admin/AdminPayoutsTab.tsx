import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Payout } from "@/components/admin/types";
import AdminFormDialog from "@/components/admin/AdminFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DatePickerField from "@/components/shared/DatePickerField";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { downloadCsv, toCsv } from "@/lib/csv";
import { toDateInputValue } from "@/lib/date";

type AdminPayoutsTabProps = {
  payouts: Payout[];
  editingPayout: Payout | null;
  setEditingPayout: Dispatch<SetStateAction<Payout | null>>;
  savePayout: () => Promise<void> | void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
  formatMoney: (cents?: number | null) => string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const AdminPayoutsTab = ({
  payouts,
  editingPayout,
  setEditingPayout,
  savePayout,
  statusVariant,
  formatMoney,
}: AdminPayoutsTabProps) => {
  const [statusFilter, setStatusFilter] = useState<Payout["payoutStatus"] | "all">("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((payout) => {
      const matchesStatus = statusFilter === "all" ? true : payout.payoutStatus === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query
        ? true
        : [
            payout.listingTitle,
            payout.bookingId,
            payout.buyerName,
            payout.notes,
            payout.paymentMethod,
            payout.paymentStatus,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
      const comparedDate = toDateInputValue(new Date(payout.payoutAt || payout.createdAt));
      const matchesFrom = fromDate ? comparedDate >= fromDate : true;
      const matchesTo = toDate ? comparedDate <= toDate : true;
      return matchesStatus && matchesSearch && matchesFrom && matchesTo;
    });
  }, [fromDate, payouts, search, statusFilter, toDate]);

  const exportCsv = () => {
    const csv = toCsv(
      filteredPayouts.map((payout) => ({
        listing: payout.listingTitle || payout.listingId.slice(0, 8),
        booking: payout.bookingId.slice(0, 8),
        buyer: payout.buyerName || "--",
        gross: payout.amountCents / 100,
        commission: payout.feeCents / 100,
        payout: payout.payoutAmountCents / 100,
        status: payout.payoutStatus,
        payout_at: payout.payoutAt || "--",
        notes: payout.notes || "--",
      })),
      ["listing", "booking", "buyer", "gross", "commission", "payout", "status", "payout_at", "notes"]
    );
    downloadCsv(`admin-payouts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <TabsContent value="payouts" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Payouts</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Review seller booking payouts, settle completed items, and keep payout notes in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {payouts.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {payouts.filter((item) => item.payoutStatus === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {payouts.filter((item) => item.payoutStatus === "paid").length} paid
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {payouts.filter((item) => item.payoutStatus === "failed").length} failed
              </div>
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filteredPayouts.length === 0}>
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="grid gap-2">
              <Label>Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by listing, buyer, booking ID, notes, or payment method"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
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
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>From</Label>
              <DatePickerField value={fromDate} onChange={setFromDate} placeholder="Any date" />
            </div>
            <div className="grid gap-2">
              <Label>To</Label>
              <DatePickerField value={toDate} onChange={setToDate} placeholder="Any date" minDate={fromDate} />
            </div>
          </div>

          <div className="grid gap-4 md:hidden">
            {filteredPayouts.map((payout) => (
              <div key={payout.id} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{payout.listingTitle ?? payout.listingId.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Booking #{payout.bookingId.slice(0, 8)}</p>
                  </div>
                  <Badge variant={statusVariant(payout.payoutStatus)} className="capitalize">
                    {payout.payoutStatus}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <span>Buyer</span>
                    <span className="text-right">{payout.buyerName || "--"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Amount</span>
                    <span className="text-right">{formatMoney(payout.amountCents)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Fee</span>
                    <span className="text-right">{formatMoney(payout.feeCents)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Payout</span>
                    <span className="text-right">{formatMoney(payout.payoutAmountCents)}</span>
                  </div>
                </div>
                {payout.notes ? <p className="mt-3 text-xs text-muted-foreground">{payout.notes}</p> : null}
                <div className="mt-4 flex gap-2">
                  <Dialog
                    open={editingPayout?.id === payout.id}
                    onOpenChange={(open) => {
                      if (!open) setEditingPayout(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditingPayout({ ...payout })}>
                        Review
                      </Button>
                    </DialogTrigger>
                    {editingPayout && (
                      <AdminFormDialog
                        title="Review Payout"
                        description="Approve, reject, or leave notes for this seller payout."
                        actionLabel="Save"
                        onAction={savePayout}
                      >
                        <div className="grid gap-2">
                          <Label>Status</Label>
                          <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            value={editingPayout.payoutStatus}
                            onChange={(e) =>
                              setEditingPayout({
                                ...editingPayout,
                                payoutStatus: e.target.value as Payout["payoutStatus"],
                              })
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={editingPayout.notes ?? ""}
                            onChange={(e) =>
                              setEditingPayout({
                                ...editingPayout,
                                notes: e.target.value || null,
                              })
                            }
                            placeholder="Optional review notes"
                          />
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">{editingPayout.listingTitle ?? editingPayout.listingId.slice(0, 8)}</p>
                          <p className="mt-1">Buyer: {editingPayout.buyerName || "--"}</p>
                          <p className="mt-1">Created: {formatDateTime(editingPayout.createdAt)}</p>
                          <p className="mt-1">Payout at: {formatDateTime(editingPayout.payoutAt)}</p>
                        </div>
                      </AdminFormDialog>
                    )}
                  </Dialog>
                </div>
              </div>
            ))}
            {filteredPayouts.length === 0 ? (
              <div className="rounded-xl border border-border bg-background/60 p-6 text-sm text-muted-foreground">
                No payouts match the current filters.
              </div>
            ) : null}
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.listingTitle ?? payout.listingId.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Booking #{payout.bookingId.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(payout.createdAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{payout.buyerName || "--"}</TableCell>
                    <TableCell>{formatMoney(payout.amountCents)}</TableCell>
                    <TableCell>{formatMoney(payout.payoutAmountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payout.payoutStatus)} className="capitalize">
                        {payout.payoutStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog
                        open={editingPayout?.id === payout.id}
                        onOpenChange={(open) => {
                          if (!open) setEditingPayout(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" onClick={() => setEditingPayout({ ...payout })}>
                            Review
                          </Button>
                        </DialogTrigger>
                        {editingPayout && (
                          <AdminFormDialog
                            title="Review Payout"
                            description="Approve, reject, or leave notes for this seller payout."
                            actionLabel="Save"
                            onAction={savePayout}
                          >
                            <div className="grid gap-2">
                              <Label>Status</Label>
                              <select
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                value={editingPayout.payoutStatus}
                                onChange={(e) =>
                                  setEditingPayout({
                                    ...editingPayout,
                                    payoutStatus: e.target.value as Payout["payoutStatus"],
                                  })
                                }
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="failed">Failed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Notes</Label>
                              <Textarea
                                value={editingPayout.notes ?? ""}
                                onChange={(e) =>
                                  setEditingPayout({
                                    ...editingPayout,
                                    notes: e.target.value || null,
                                  })
                                }
                                placeholder="Optional review notes"
                              />
                            </div>
                          </AdminFormDialog>
                        )}
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No payouts match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminPayoutsTab;
