import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

type ServiceBooking = {
  id: string;
  serviceId: string;
  serviceTitle: string | null;
  contactName: string | null;
  contactPhone: string | null;
  scheduledDate: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const MyServiceBookings = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiFetch("/api/service-bookings", { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load service bookings");
      setBookings(await resp.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load your service bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const cancelBooking = async (id: string) => {
    const resp = await apiFetch(`/api/service-bookings/${id}`, {
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
            <h1 className="font-display text-3xl tracking-wider">My Service Bookings</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your service appointments.
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
                      <TableHead>Booking</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{booking.id.slice(0, 8)}</TableCell>
                        <TableCell>{booking.serviceTitle ?? booking.serviceId.slice(0, 8)}</TableCell>
                        <TableCell>{booking.scheduledDate ?? "--"}</TableCell>
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

export default MyServiceBookings;
