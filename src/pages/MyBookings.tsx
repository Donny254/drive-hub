import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

type Booking = {
  id: string;
  listingId: string;
  listingTitle: string | null;
  listingImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "pending" | "confirmed" | "cancelled";
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  amountCents?: number | null;
  createdAt: string;
};

const MyBookings = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiFetch("/api/bookings", { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load bookings");
      setBookings(await resp.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load your bookings.");
      toast.error("Failed to load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const cancelBooking = async (id: string) => {
    const resp = await apiFetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      toast.error(errorData.error || "Failed to cancel booking");
      throw new Error(errorData.error || "Failed to cancel booking");
    }
    await fetchBookings();
    toast.success("Booking cancelled.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="font-display text-3xl tracking-wider">My Bookings</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your bookings.
            </p>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading bookings...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <>
                <div className="grid gap-4 md:hidden">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        {booking.listingImageUrl ? (
                          <img
                            src={resolveImageUrl(booking.listingImageUrl)}
                            alt={booking.listingTitle ?? "Listing"}
                            className="h-16 w-20 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="h-16 w-20 rounded-md border border-dashed border-border bg-secondary/40" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">{booking.listingTitle ?? booking.listingId.slice(0, 8)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between gap-3"><span>Start</span><span className="text-right break-words">{booking.startDate ?? "--"}</span></div>
                        <div className="flex justify-between gap-3"><span>End</span><span className="text-right break-words">{booking.endDate ?? "--"}</span></div>
                        <div className="flex justify-between gap-3"><span>Payment</span><span className="text-right break-words capitalize">{booking.paymentStatus ?? "unpaid"}{booking.amountCents ? ` - KES ${(booking.amountCents / 100).toLocaleString()}` : ""}</span></div>
                        <div className="flex justify-between gap-3"><span>Status</span><span className="text-right capitalize">{booking.status}</span></div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-4 w-full"
                        disabled={booking.status === "cancelled"}
                        onClick={() => setCancelTarget(booking)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="hidden rounded-xl border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Listing</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          {booking.listingImageUrl ? (
                            <img
                              src={resolveImageUrl(booking.listingImageUrl)}
                              alt={booking.listingTitle ?? "Listing"}
                              className="h-12 w-16 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                          )}
                        </TableCell>
                        <TableCell>{booking.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {booking.listingTitle ?? booking.listingId.slice(0, 8)}
                        </TableCell>
                        <TableCell>{booking.startDate ?? "--"}</TableCell>
                        <TableCell>{booking.endDate ?? "--"}</TableCell>
                        <TableCell className="capitalize">
                          {booking.paymentStatus ?? "unpaid"}
                          {booking.amountCents
                            ? ` - KES ${(booking.amountCents / 100).toLocaleString()}`
                            : ""}
                        </TableCell>
                        <TableCell className="capitalize">{booking.status}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={booking.status === "cancelled"}
                            onClick={() => setCancelTarget(booking)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <ActionConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel booking?"
        description={`This will cancel booking ${cancelTarget ? `#${cancelTarget.id.slice(0, 8)}` : ""}. You can’t undo this from your account.`}
        cancelLabel="Keep Booking"
        confirmLabel="Cancel Booking"
        loading={cancelLoading}
        loadingLabel="Cancelling..."
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            setCancelLoading(true);
            await cancelBooking(cancelTarget.id);
            setCancelTarget(null);
          } finally {
            setCancelLoading(false);
          }
        }}
      />
      <Footer />
    </div>
  );
};

export default MyBookings;
