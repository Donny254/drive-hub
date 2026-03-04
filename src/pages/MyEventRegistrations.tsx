import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

type EventRegistration = {
  id: string;
  eventId: string;
  eventTitle: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const MyEventRegistrations = () => {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiFetch("/api/event-registrations", { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load registrations");
      setRegistrations(await resp.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load your event registrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const cancelRegistration = async (id: string) => {
    const resp = await apiFetch(`/api/event-registrations/${id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!resp.ok) throw new Error("Failed to cancel registration");
    fetchRegistrations();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div>
            <h1 className="font-display text-3xl tracking-wider">My Event Registrations</h1>
            <p className="text-muted-foreground mt-1">View and manage your event registrations.</p>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading registrations...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <div className="rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((registration) => (
                      <TableRow key={registration.id}>
                        <TableCell>{registration.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {registration.eventTitle ?? registration.eventId.slice(0, 8)}
                        </TableCell>
                        <TableCell>{registration.tickets}</TableCell>
                        <TableCell className="capitalize">{registration.status}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={registration.status === "cancelled"}
                            onClick={() => cancelRegistration(registration.id)}
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

export default MyEventRegistrations;
