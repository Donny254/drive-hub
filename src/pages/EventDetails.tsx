import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MapPin } from "lucide-react";
import carEvent from "@/assets/car-event.jpg";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  status: "upcoming" | "past" | "cancelled";
  registrationsCount?: number;
};

type EventRegistration = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "TBA";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(start || end);
};

const statusBadgeVariant = (status: EventItem["status"]) => {
  if (status === "cancelled") return "destructive" as const;
  if (status === "past") return "secondary" as const;
  return "default" as const;
};

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tickets, setTickets] = useState(1);
  const [notes, setNotes] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch(`/api/events/${id}`);
        if (!resp.ok) throw new Error("Failed to load event");
        setEvent(await resp.json());
      } catch {
        setError("Event not found.");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  useEffect(() => {
    const loadRegistrations = async () => {
      if (!event || user?.role !== "admin") return;
      try {
        setRegistrationsLoading(true);
        setRegistrationsError(null);
        const resp = await apiFetch(`/api/event-registrations?eventId=${event.id}`, {
          headers: authHeaders,
        });
        if (!resp.ok) throw new Error("Failed to load registrations");
        setRegistrations(await resp.json());
      } catch (err) {
        console.error(err);
        setRegistrationsError("Failed to load registrations.");
      } finally {
        setRegistrationsLoading(false);
      }
    };
    loadRegistrations();
  }, [event, user, authHeaders]);

  useEffect(() => {
    if (!registerOpen) return;
    setRegisterError(null);
    setRegisterSuccess(null);
    setContactName(user?.name || user?.email || "");
    setContactPhone("");
    setTickets(1);
    setNotes("");
  }, [registerOpen, user]);

  const openRegister = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRegisterOpen(true);
  };

  const submitRegistration = async () => {
    if (!event) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      setRegisterError("Name and phone are required.");
      return;
    }
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const resp = await apiFetch("/api/event-registrations", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          eventId: event.id,
          contactName,
          contactPhone,
          tickets,
          notes: notes || null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to register for event");
      }

      setRegisterSuccess("Registration submitted. We will contact you soon.");
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {loading && <p className="text-muted-foreground">Loading event...</p>}
          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && event && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
                    {event.status}
                  </Badge>
                  <Badge variant="secondary">
                    {formatDateRange(event.startDate, event.endDate)}
                  </Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
                  Back
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h1 className="font-display text-4xl tracking-wider">{event.title}</h1>
                  <p className="text-muted-foreground text-lg">
                    {event.description ?? "Details coming soon."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={16} />
                        Schedule
                      </div>
                      <p className="mt-2 font-medium">
                        {formatDateRange(event.startDate, event.endDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={16} />
                        Location
                      </div>
                      <p className="mt-2 font-medium">{event.location ?? "TBA"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Registrations</p>
                      <p className="mt-2 font-medium">{event.registrationsCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {event.status === "upcoming" && (
                      <Button variant="hero" size="lg" onClick={openRegister}>
                        Register Now
                      </Button>
                    )}
                    {user?.role === "admin" && (
                      <Badge variant="secondary">Admin view</Badge>
                    )}
                  </div>
                </div>

                <img
                  src={resolveImageUrl(event.imageUrl) || carEvent}
                  alt={event.title}
                  className="w-full rounded-2xl border border-border object-cover min-h-[320px]"
                />
              </div>

              {user?.role === "admin" && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h2 className="font-display text-2xl tracking-wider">Registrations</h2>
                  {registrationsLoading && (
                    <p className="text-muted-foreground mt-2">Loading registrations...</p>
                  )}
                  {registrationsError && (
                    <p className="text-sm text-destructive mt-2">{registrationsError}</p>
                  )}
                  {!registrationsLoading && !registrationsError && (
                    <div className="mt-4 rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Tickets</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrations.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-muted-foreground">
                                No registrations yet.
                              </TableCell>
                            </TableRow>
                          )}
                          {registrations.map((reg) => (
                            <TableRow key={reg.id}>
                              <TableCell>{reg.contactName ?? "--"}</TableCell>
                              <TableCell>{reg.contactPhone ?? "--"}</TableCell>
                              <TableCell>{reg.tickets}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    reg.status === "confirmed"
                                      ? "default"
                                      : reg.status === "cancelled"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="capitalize"
                                >
                                  {reg.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(reg.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register{event ? `: ${event.title}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Tickets</Label>
              <Input
                type="number"
                min={1}
                value={tickets}
                onChange={(e) => setTickets(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {registerError && <p className="text-sm text-destructive">{registerError}</p>}
            {registerSuccess && <p className="text-sm text-emerald-500">{registerSuccess}</p>}
          </div>
          <DialogFooter>
            {registerSuccess ? (
              <Button variant="hero" onClick={() => setRegisterOpen(false)}>
                Done
              </Button>
            ) : (
              <Button variant="hero" onClick={submitRegistration} disabled={registerLoading}>
                {registerLoading ? "Submitting..." : "Submit Registration"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetails;
