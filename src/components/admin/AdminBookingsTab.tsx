import type { Dispatch, SetStateAction } from "react";
import type { Booking, DeleteTarget } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { resolveImageUrl } from "@/lib/api";
import CryptoProofUploader from "@/components/shared/CryptoProofUploader";

type AdminBookingsTabProps = {
  bookings: Booking[];
  editingBooking: Booking | null;
  setEditingBooking: Dispatch<SetStateAction<Booking | null>>;
  saveBooking: () => Promise<void> | void;
  setDeleteTarget: Dispatch<SetStateAction<DeleteTarget>>;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
  formatMoney: (cents?: number | null) => string;
  token?: string | null;
};

const AdminBookingsTab = ({
  bookings,
  editingBooking,
  setEditingBooking,
  saveBooking,
  setDeleteTarget,
  statusVariant,
  formatMoney,
  token,
}: AdminBookingsTabProps) => {
  return (
    <TabsContent value="bookings" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Vehicle Bookings</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage reservation status, payment state, and booking timelines from one view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {bookings.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {bookings.filter((booking) => booking.status === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {bookings.filter((booking) => booking.status === "confirmed").length} confirmed
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:hidden">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start gap-3">
                  {booking.listingImageUrl ? (
                    <img
                      src={resolveImageUrl(booking.listingImageUrl)}
                      alt={booking.listingTitle ?? "Listing"}
                      className="h-14 w-20 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="h-14 w-20 rounded-md border border-dashed border-border bg-secondary/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{booking.listingTitle ?? booking.listingId.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      Booking {booking.id.slice(0, 8)} • User {booking.userId.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Schedule</span><span className="text-right break-words">{booking.startDate ?? "--"} to {booking.endDate ?? "--"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Payment</span><span className="text-right break-words capitalize">{booking.paymentMethod ?? "manual"} • {booking.paymentStatus ?? "unpaid"}{booking.amountCents ? ` • ${formatMoney(booking.amountCents)}` : ""}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><Badge variant={statusVariant(booking.status)} className="capitalize">{booking.status}</Badge></div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Dialog
                    open={editingBooking?.id === booking.id}
                    onOpenChange={(open) => {
                      if (!open) setEditingBooking(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditingBooking({ ...booking })}>
                        Update
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Booking</DialogTitle>
                        <DialogDescription>
                          Change the status of this booking request to approve, reject, or cancel it.
                        </DialogDescription>
                      </DialogHeader>
                      {editingBooking && (
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label>Status</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingBooking.status}
                              onChange={(e) =>
                                setEditingBooking({
                                  ...editingBooking,
                                  status: e.target.value as Booking["status"],
                                })
                              }
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment Method</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingBooking.paymentMethod ?? ""}
                              onChange={(e) =>
                                setEditingBooking({
                                  ...editingBooking,
                                  paymentMethod: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Not set</option>
                              <option value="mpesa">M-Pesa</option>
                              <option value="crypto">Crypto</option>
                              <option value="bank">Bank</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment Status</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingBooking.paymentStatus ?? "unpaid"}
                              onChange={(e) =>
                                setEditingBooking({
                                  ...editingBooking,
                                  paymentStatus: e.target.value as Booking["paymentStatus"],
                                })
                              }
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="failed">Failed</option>
                            </select>
                          </div>
                          {editingBooking.paymentMethod === "crypto" && (
                            <div className="grid gap-4">
                              <CryptoProofUploader
                                token={token}
                                proofImageUrl={editingBooking.cryptoProofImageUrl ?? null}
                                onProofImageUrlChange={(value) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    cryptoProofImageUrl: value,
                                  })
                                }
                                label="Crypto Proof Image"
                                description="Upload or replace the crypto transfer proof linked to this booking."
                              />
                              <div className="grid gap-2">
                                <Label>Crypto Review Notes</Label>
                                <Textarea
                                  value={editingBooking.cryptoReviewNotes ?? ""}
                                  onChange={(e) =>
                                    setEditingBooking({
                                      ...editingBooking,
                                      cryptoReviewNotes: e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="hero" onClick={saveBooking}>
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "booking",
                        id: booking.id,
                        label: booking.id.slice(0, 8),
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {booking.listingImageUrl ? (
                          <img
                            src={resolveImageUrl(booking.listingImageUrl)}
                            alt={booking.listingTitle ?? "Listing"}
                            className="h-12 w-16 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                        )}
                        <div>
                          <p className="font-medium">{booking.listingTitle ?? booking.listingId.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Booking {booking.id.slice(0, 8)} • User {booking.userId.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{booking.startDate ?? "--"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">to {booking.endDate ?? "--"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <Badge variant={statusVariant(booking.paymentStatus ?? "pending")} className="capitalize">
                          {booking.paymentStatus ?? "unpaid"}
                        </Badge>
                        {booking.amountCents ? (
                          <p className="mt-1 text-xs text-muted-foreground">{formatMoney(booking.amountCents)}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                          {booking.paymentMethod ?? "manual"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(booking.status)} className="capitalize">
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingBooking?.id === booking.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingBooking(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditingBooking({ ...booking })}>
                              Update
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Booking</DialogTitle>
                              <DialogDescription>
                                Change the status of this booking request to approve, reject, or cancel it.
                              </DialogDescription>
                            </DialogHeader>
                            {editingBooking && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingBooking.status}
                                    onChange={(e) =>
                                      setEditingBooking({
                                        ...editingBooking,
                                        status: e.target.value as Booking["status"],
                                      })
                                    }
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Payment Method</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingBooking.paymentMethod ?? ""}
                                    onChange={(e) =>
                                      setEditingBooking({
                                        ...editingBooking,
                                        paymentMethod: e.target.value || null,
                                      })
                                    }
                                  >
                                    <option value="">Not set</option>
                                    <option value="mpesa">M-Pesa</option>
                                    <option value="crypto">Crypto</option>
                                    <option value="bank">Bank</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Payment Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingBooking.paymentStatus ?? "unpaid"}
                                    onChange={(e) =>
                                      setEditingBooking({
                                        ...editingBooking,
                                        paymentStatus: e.target.value as Booking["paymentStatus"],
                                      })
                                    }
                                  >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="failed">Failed</option>
                                  </select>
                                </div>
                                {editingBooking.paymentMethod === "crypto" && (
                                  <div className="grid gap-2">
                                    <Label>Crypto Review Notes</Label>
                                    <Textarea
                                      value={editingBooking.cryptoReviewNotes ?? ""}
                                      onChange={(e) =>
                                        setEditingBooking({
                                          ...editingBooking,
                                          cryptoReviewNotes: e.target.value || null,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveBooking}>
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "booking",
                              id: booking.id,
                              label: booking.id.slice(0, 8),
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminBookingsTab;
