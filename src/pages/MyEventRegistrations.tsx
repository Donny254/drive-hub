import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { getTicketQrImageUrl, toTicketQrPayload } from "@/lib/ticketQr";
import { downloadEventReceipt, printEventReceipt } from "@/lib/printEventReceipt";
import { toast } from "@/components/ui/sonner";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

type EventRegistration = {
  id: string;
  eventId: string;
  eventTitle: string | null;
  eventLocation: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  amountCents: number;
  paymentMethod: string | null;
  paymentStatus: "unpaid" | "pending" | "paid" | "failed";
  paidAt: string | null;
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

const formatCurrency = (amountCents?: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);

const MyEventRegistrations = () => {
  const { token } = useAuth();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [ticketsByRegistration, setTicketsByRegistration] = useState<Record<string, EventTicket[]>>({});
  const [ticketsLoadingId, setTicketsLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventRegistration | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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
      toast.error("Failed to load your event registrations.");
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
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      toast.error(errorData.error || "Failed to cancel registration");
      throw new Error(errorData.error || "Failed to cancel registration");
    }
    await fetchRegistrations();
    toast.success("Registration cancelled.");
  };

  const payRegistration = async (registration: EventRegistration) => {
    const resp = await apiFetch("/api/payments/mpesa/stkpush-event-registration", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        registrationId: registration.id,
        phoneNumber: registration.contactPhone,
      }),
    });
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      const message = errorData.error || "Failed to start M-Pesa payment";
      toast.error(message);
      throw new Error(message);
    }
    await fetchRegistrations();
    toast.success("M-Pesa prompt sent. Complete payment on your phone.");
  };

  const loadTickets = async (registrationId: string) => {
    if (ticketsByRegistration[registrationId]) return;
    setTicketsLoadingId(registrationId);
    try {
      const resp = await apiFetch(`/api/event-registrations/registration/${registrationId}/tickets`, {
        headers: authHeaders,
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load tickets");
      }
      const tickets = (await resp.json()) as EventTicket[];
      setTicketsByRegistration((prev) => ({ ...prev, [registrationId]: tickets }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tickets");
    } finally {
      setTicketsLoadingId(null);
    }
  };

  const handlePrintReceipt = async (registration: EventRegistration) => {
    const tickets = ticketsByRegistration[registration.id] || [];
    await printEventReceipt(registration, tickets);
    toast.success("Receipt opened for printing.");
  };

  const handleDownloadReceipt = async (registration: EventRegistration) => {
    const tickets = ticketsByRegistration[registration.id] || [];
    await downloadEventReceipt(registration, tickets);
    toast.success("Receipt downloaded.");
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
              <>
                <div className="grid gap-4 md:hidden">
                  {registrations.map((registration) => (
                    <div key={registration.id} className="rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="font-medium break-words">{registration.eventTitle ?? registration.eventId.slice(0, 8)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Registration #{registration.id.slice(0, 8)}</p>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                        <div className="flex justify-between gap-3"><span>Tickets</span><span>{registration.tickets}</span></div>
                        <div className="flex justify-between gap-3"><span>Amount</span><span className="text-right break-words">{registration.amountCents > 0 ? formatCurrency(registration.amountCents) : "Free"}</span></div>
                        <div className="flex justify-between gap-3"><span>Payment</span><span className="text-right capitalize">{registration.paymentStatus}</span></div>
                        <div className="flex justify-between gap-3"><span>Status</span><span className="text-right capitalize">{registration.status}</span></div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => loadTickets(registration.id)}
                            >
                              View Tickets
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                            <DialogHeader>
                              <DialogTitle>Tickets for {registration.eventTitle ?? "Event"}</DialogTitle>
                              <DialogDescription>
                                Review issued tickets, scan-ready QR codes, and receipt actions for this event registration.
                              </DialogDescription>
                            </DialogHeader>
                            {ticketsLoadingId === registration.id && (
                              <p className="text-sm text-muted-foreground">Loading tickets...</p>
                            )}
                            {ticketsLoadingId !== registration.id &&
                              (ticketsByRegistration[registration.id]?.length ? (
                                <div className="space-y-2">
                                  {ticketsByRegistration[registration.id].map((ticket) => (
                                    <div key={ticket.id} className="rounded-md border border-border p-3">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <div className="font-mono text-sm">{ticket.ticketNumber}</div>
                                          <div className="mt-1 text-xs capitalize text-muted-foreground">
                                            {ticket.status}
                                          </div>
                                        </div>
                                        <img
                                          src={getTicketQrImageUrl(ticket.ticketNumber, 120)}
                                          alt={`QR for ${ticket.ticketNumber}`}
                                          className="h-[120px] w-[120px] rounded border border-border"
                                        />
                                      </div>
                                      <div className="mt-2 break-all text-[11px] text-muted-foreground">
                                        {toTicketQrPayload(ticket.ticketNumber)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {registration.paymentStatus === "paid"
                                    ? "No tickets found."
                                    : "Tickets will appear here after payment is confirmed."}
                                </p>
                              ))}
                            <DialogFooter className="flex-col gap-2 sm:flex-row">
                              <Button
                                variant="hero"
                                onClick={() => void handlePrintReceipt(registration)}
                                disabled={ticketsLoadingId === registration.id || !ticketsByRegistration[registration.id]?.length}
                              >
                                Print Receipt
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => void handleDownloadReceipt(registration)}
                                disabled={ticketsLoadingId === registration.id || !ticketsByRegistration[registration.id]?.length}
                              >
                                Download PDF
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {registration.amountCents > 0 && registration.paymentStatus !== "paid" && (
                          <Button
                            variant="hero"
                            size="sm"
                            className="w-full"
                            disabled={!registration.contactPhone || registration.status === "cancelled"}
                            onClick={() => payRegistration(registration)}
                          >
                            Pay Now
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          disabled={registration.status === "cancelled"}
                          onClick={() => setCancelTarget(registration)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden rounded-xl border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
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
                        <TableCell>{registration.amountCents > 0 ? formatCurrency(registration.amountCents) : "Free"}</TableCell>
                        <TableCell className="capitalize">{registration.paymentStatus}</TableCell>
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
                                <DialogDescription>
                                  Review issued tickets, scan-ready QR codes, and receipt actions for this event registration.
                                </DialogDescription>
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
                                        className="rounded-md border border-border p-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="font-mono text-sm">{ticket.ticketNumber}</div>
                                            <div className="text-xs capitalize text-muted-foreground mt-1">
                                              {ticket.status}
                                            </div>
                                          </div>
                                          <img
                                            src={getTicketQrImageUrl(ticket.ticketNumber, 120)}
                                            alt={`QR for ${ticket.ticketNumber}`}
                                            className="h-[120px] w-[120px] rounded border border-border"
                                          />
                                        </div>
                                        <div className="mt-2 text-[11px] text-muted-foreground break-all">
                                          {toTicketQrPayload(ticket.ticketNumber)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {registration.paymentStatus === "paid"
                                      ? "No tickets found."
                                      : "Tickets will appear here after payment is confirmed."}
                                  </p>
                                ))}
                              <DialogFooter>
                                <Button
                                  variant="hero"
                                  onClick={() => void handlePrintReceipt(registration)}
                                  disabled={ticketsLoadingId === registration.id || !ticketsByRegistration[registration.id]?.length}
                                >
                                  Print Receipt
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => void handleDownloadReceipt(registration)}
                                  disabled={ticketsLoadingId === registration.id || !ticketsByRegistration[registration.id]?.length}
                                >
                                  Download PDF
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                        <TableCell className="capitalize">{registration.status}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {registration.amountCents > 0 && registration.paymentStatus !== "paid" && (
                              <Button
                                variant="hero"
                                size="sm"
                                disabled={!registration.contactPhone || registration.status === "cancelled"}
                                onClick={() => payRegistration(registration)}
                              >
                                Pay Now
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={registration.status === "cancelled"}
                              onClick={() => setCancelTarget(registration)}
                            >
                              Cancel
                            </Button>
                          </div>
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
        title="Cancel registration?"
        description={`This will cancel your registration${cancelTarget?.eventTitle ? ` for "${cancelTarget.eventTitle}"` : ""}. You can’t undo this from your account.`}
        cancelLabel="Keep Registration"
        confirmLabel="Cancel Registration"
        loading={cancelLoading}
        loadingLabel="Cancelling..."
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            setCancelLoading(true);
            await cancelRegistration(cancelTarget.id);
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

export default MyEventRegistrations;
