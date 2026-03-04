import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl } from "@/lib/api";

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
    if (!resp.ok) throw new Error("Failed to cancel booking");
    fetchBookings();
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
              <div className="rounded-xl border border-border bg-card">
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
                            onClick={() => cancelBooking(booking.id)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyBookings;
