import { useCallback, useEffect, useMemo, useState } from "react";
import AccountLayout from "@/components/shared/AccountLayout";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

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
  const [cancelTarget, setCancelTarget] = useState<ServiceBooking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiFetch("/api/service-bookings", { headers: authHeaders, signal });
      if (!resp.ok) throw new Error("Failed to load service bookings");
      const json = await resp.json();
      setBookings(Array.isArray(json) ? json : (json.data ?? []));
    } catch (err) {
      if (err instanceof DOMException && (err as DOMException).name === "AbortError") return;
      console.error(err);
      setError("Failed to load your service bookings.");
      toast.error("Failed to load your service bookings.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  const cancelBooking = async (id: string) => {
    const resp = await apiFetch(`/api/service-bookings/${id}`, {
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
    toast.success("Service booking cancelled.");
  };

  return (
    <AccountLayout title="Service Bookings">
      <div>
          <div className="mt-0">
            {loading && <p className="text-muted-foreground">Loading bookings...</p>}
            {!loading && error && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void fetchBookings()}>Retry</Button>
              </div>
            )}

            {!loading && !error && bookings.length === 0 && (
              <EmptyState
                icon={Wrench}
                title="No service bookings yet"
                description="When you book an automotive service it will appear here."
                action={{ label: "Browse Services", to: "/services" }}
              />
            )}

            {!loading && !error && bookings.length > 0 && (
              <>
                <div className="grid gap-4 md:hidden">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="font-medium break-words">{booking.serviceTitle ?? booking.serviceId.slice(0, 8)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between gap-3"><span>Scheduled</span><span className="text-right break-words">{booking.scheduledDate ?? "--"}</span></div>
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
      <ActionConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel service booking?"
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
      </div>
    </AccountLayout>
  );
};

export default MyServiceBookings;
