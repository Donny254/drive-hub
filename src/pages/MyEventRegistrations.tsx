import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

type EventTicket = {
  id: string;
  ticketNumber: string;
  status: "issued" | "checked_in" | "cancelled";
  checkedInAt: string | null;
};

const MyEventRegistrations = () => {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [ticketsByRegistration, setTicketsByRegistration] = useState<Record<string, EventTicket[]>>({});
  const [ticketsLoadingId, setTicketsLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchRegistrations = useCallback(async () => {
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
  }, [authHeaders]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const cancelRegistration = async (id: string) => {
    const resp = await apiFetch(`/api/event-registrations/${id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!resp.ok) throw new Error("Failed to cancel registration");
    fetchRegistrations();
  };

  const loadTickets = async (registrationId: string) => {
    if (ticketsByRegistration[registrationId]) return;
    setTicketsLoadingId(registrationId);
    try {
      const resp = await apiFetch(`/api/event-registrations/registration/${registrationId}/tickets`, {
        headers: authHeaders,
      });
      if (!resp.ok) throw new Error("Failed to load tickets");
      const tickets = (await resp.json()) as EventTicket[];
      setTicketsByRegistration((prev) => ({ ...prev, [registrationId]: tickets }));
    } finally {
      setTicketsLoadingId(null);
    }
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
                      <TableHead>Ticket Codes</TableHead>
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
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => loadTickets(registration.id)}
                              >
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Tickets for {registration.eventTitle ?? "Event"}</DialogTitle>
                              </DialogHeader>
                              {ticketsLoadingId === registration.id && (
                                <p className="text-sm text-muted-foreground">Loading tickets...</p>
                              )}
                              {ticketsLoadingId !== registration.id &&
                                (ticketsByRegistration[registration.id]?.length ? (
                                  <div className="space-y-2">
                                    {ticketsByRegistration[registration.id].map((ticket) => (
                                      <div
                                        key={ticket.id}
                                        className="flex items-center justify-between rounded-md border border-border p-2"
                                      >
                                        <span className="font-mono text-sm">{ticket.ticketNumber}</span>
                                        <span className="text-xs capitalize text-muted-foreground">
                                          {ticket.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No tickets found.</p>
                                ))}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
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
