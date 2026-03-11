import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MapPin, ArrowRight, Flame, Star } from "lucide-react";
import carEvent from "@/assets/car-event.jpg";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { downloadEventReceipt, printEventReceipt } from "@/lib/printEventReceipt";
import { useAuth } from "@/context/AuthContext";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  priceCents: number;
  status: "upcoming" | "past" | "cancelled";
};

type BlogPost = {
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
};

type EventTicket = {
  id: string;
  ticketNumber: string;
  status: "issued" | "checked_in" | "cancelled";
};

type RegistrationResponse = {
  id: string;
  paymentRequired: boolean;
  generatedTickets?: EventTicket[];
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

const formatCurrency = (amountCents?: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);

const statusBadgeVariant = (status: EventItem["status"]) => {
  if (status === "cancelled") return "destructive" as const;
  if (status === "past") return "secondary" as const;
  return "default" as const;
};

const Events = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [activeSection, setActiveSection] = useState<"events" | "blogs">("events");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tickets, setTickets] = useState(1);
  const [notes, setNotes] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [generatedTickets, setGeneratedTickets] = useState<EventTicket[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [pendingRegistrationId, setPendingRegistrationId] = useState<string | null>(null);
  const [completedRegistrationId, setCompletedRegistrationId] = useState<string | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const totalAmountCents = (selectedEvent?.priceCents || 0) * tickets;
  const isPaidEvent = totalAmountCents > 0;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [eventsRes, postsRes] = await Promise.all([
          apiFetch("/api/events?status=upcoming"),
          apiFetch("/api/posts?status=published"),
        ]);
        if (eventsRes.ok) setEvents(await eventsRes.json());
        if (postsRes.ok) setPosts(await postsRes.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!registerOpen) return;
    setRegisterError(null);
    setRegisterSuccess(null);
    setContactName(user?.name || user?.email || "");
    setContactPhone("");
    setTickets(1);
    setNotes("");
    setGeneratedTickets([]);
    setPendingRegistrationId(null);
    setCompletedRegistrationId(null);
  }, [registerOpen, user]);

  useEffect(() => {
    if (!registerOpen || !pendingRegistrationId) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const resp = await apiFetch(`/api/payments/mpesa/event-registration-status/${pendingRegistrationId}`, {
          headers: authHeaders,
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const paymentStatus = data?.registration?.paymentStatus;
        if (paymentStatus === "paid") {
          const ticketsResp = await apiFetch(
            `/api/event-registrations/registration/${pendingRegistrationId}/tickets`,
            { headers: authHeaders }
          );
          const ticketsData = ticketsResp.ok ? await ticketsResp.json() : [];
          if (!cancelled) {
            setGeneratedTickets(Array.isArray(ticketsData) ? ticketsData : []);
            setRegisterSuccess("Payment received. Your tickets are ready.");
            setPendingRegistrationId(null);
            setCompletedRegistrationId(pendingRegistrationId);
          }
          return;
        }
        if (paymentStatus === "failed" && !cancelled) {
          setRegisterError("M-Pesa payment failed. Try again from My Event Registrations.");
          setPendingRegistrationId(null);
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authHeaders, pendingRegistrationId, registerOpen]);

  const openRegister = (event: EventItem) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setSelectedEvent(event);
    setRegisterOpen(true);
  };

  const submitRegistration = async () => {
    if (!selectedEvent) return;
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
          eventId: selectedEvent.id,
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

      const data = (await resp.json().catch(() => ({}))) as RegistrationResponse;

      if (data.paymentRequired) {
        const paymentResp = await apiFetch("/api/payments/mpesa/stkpush-event-registration", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            registrationId: data.id,
            phoneNumber: contactPhone,
          }),
        });
        if (!paymentResp.ok) {
          const errData = await paymentResp.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to initiate M-Pesa payment");
        }
        setPendingRegistrationId(data.id);
        setRegisterSuccess("M-Pesa prompt sent. Complete payment to generate your tickets.");
        setGeneratedTickets([]);
      } else {
        const ticketsData = Array.isArray(data.generatedTickets) ? data.generatedTickets : [];
        setGeneratedTickets(ticketsData);
        setRegisterSuccess("Registration submitted. Your tickets are ready.");
        setCompletedRegistrationId(data.id);
      }
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const featuredEvent = events[0];
  const otherEvents = events.slice(1);
  const featuredPost = posts[0];
  const otherPosts = posts.slice(1);

  const handlePrintTicket = async () => {
    if (!selectedEvent || !completedRegistrationId || generatedTickets.length === 0) return;
    await printEventReceipt(
      {
        id: completedRegistrationId,
        eventTitle: selectedEvent.title,
        eventLocation: selectedEvent.location,
        eventStartDate: selectedEvent.startDate,
        eventEndDate: selectedEvent.endDate,
        contactName,
        contactPhone,
        tickets,
        amountCents: totalAmountCents,
        paymentMethod: isPaidEvent ? "mpesa" : "free",
        paymentStatus: "paid",
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      generatedTickets
    );
  };

  const handleDownloadTicket = async () => {
    if (!selectedEvent || !completedRegistrationId || generatedTickets.length === 0) return;
    await downloadEventReceipt(
      {
        id: completedRegistrationId,
        eventTitle: selectedEvent.title,
        eventLocation: selectedEvent.location,
        eventStartDate: selectedEvent.startDate,
        eventEndDate: selectedEvent.endDate,
        contactName,
        contactPhone,
        tickets,
        amountCents: totalAmountCents,
        paymentMethod: isPaidEvent ? "mpesa" : "free",
        paymentStatus: "paid",
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      generatedTickets
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${carEvent})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          </div>

          <div className="container relative z-10 mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-sm mb-8">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary uppercase tracking-widest">
                Events & Culture
              </span>
            </div>

            <h1 className="font-display text-6xl md:text-7xl tracking-wider font-bold">
              EVENTS & <span className="text-primary">BLOG</span>
            </h1>
            <p className="text-xl text-muted-foreground mt-6 max-w-3xl mx-auto">
              Discover upcoming car events and the latest stories from the community.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
              <Button
                variant={activeSection === "events" ? "hero" : "outline"}
                size="lg"
                onClick={() => setActiveSection("events")}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Upcoming Events
              </Button>
              <Button
                variant={activeSection === "blogs" ? "hero" : "outline"}
                size="lg"
                onClick={() => setActiveSection("blogs")}
              >
                <Star className="w-5 h-5 mr-2" />
                Stories & Blog
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            {loading && <p className="text-muted-foreground">Loading...</p>}

            {!loading && activeSection === "events" && (
              <div className="space-y-10">
                {featuredEvent && (
                  <div className="grid grid-cols-1 gap-8 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-2">
                    <img
                      src={resolveImageUrl(featuredEvent.imageUrl) || carEvent}
                      alt={featuredEvent.title}
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                    <div className="flex flex-col p-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                        <Badge variant={statusBadgeVariant(featuredEvent.status)} className="capitalize">
                          {featuredEvent.status}
                        </Badge>
                      </div>
                      <h2 className="mt-4 font-display text-4xl tracking-wider break-words">{featuredEvent.title}</h2>
                      <p className="mt-4 text-muted-foreground break-words">{featuredEvent.description}</p>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span className="break-words">{formatDateRange(featuredEvent.startDate, featuredEvent.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          <span className="break-words">{featuredEvent.location ?? "TBA"}</span>
                        </div>
                        <div className="font-medium text-foreground break-words">
                          {featuredEvent.priceCents > 0 ? formatCurrency(featuredEvent.priceCents) : "Free Entry"}
                        </div>
                      </div>
                      <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
                        {featuredEvent.status === "upcoming" && (
                          <Button variant="hero" onClick={() => openRegister(featuredEvent)}>
                            Register Now <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                        <Button variant="secondary" asChild>
                          <Link to={`/events/${featuredEvent.id}`}>Learn More</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {otherEvents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    No upcoming events right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {otherEvents.map((event) => (
                      <div key={event.id} className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                        <img
                          src={resolveImageUrl(event.imageUrl) || carEvent}
                          alt={event.title}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="flex flex-1 flex-col p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {formatDateRange(event.startDate, event.endDate)}
                            </Badge>
                            <Badge variant={event.priceCents > 0 ? "outline" : "default"}>
                              {event.priceCents > 0 ? formatCurrency(event.priceCents) : "Free"}
                            </Badge>
                            <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
                              {event.status}
                            </Badge>
                          </div>
                          <h3 className="mt-3 font-display text-2xl tracking-wider break-words">{event.title}</h3>
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                            {event.description}
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin size={14} />
                            <span className="break-words">{event.location ?? "TBA"}</span>
                          </div>
                          <Button variant="outline" className="mt-auto w-full" asChild>
                            <Link to={`/events/${event.id}`}>Learn More</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && activeSection === "blogs" && (
              <div className="space-y-10">
                {featuredPost && (
                  <div className="grid grid-cols-1 gap-8 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-2">
                    <img
                      src={resolveImageUrl(featuredPost.imageUrl) || carEvent}
                      alt={featuredPost.title}
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                    <div className="flex flex-col p-8">
                      <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                      <h2 className="mt-4 font-display text-4xl tracking-wider break-words">{featuredPost.title}</h2>
                      <p className="mt-4 text-muted-foreground break-words">{featuredPost.excerpt}</p>
                      <div className="mt-4 text-sm text-muted-foreground">
                        {formatDate(featuredPost.publishedAt)}
                      </div>
                      <Button variant="hero" className="mt-auto w-full sm:w-auto" asChild>
                        <Link to={`/blog/${featuredPost.id}`}>
                          Read Story <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {otherPosts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    No blog posts available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {otherPosts.map((post) => (
                      <div key={post.id} className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                        <img
                          src={resolveImageUrl(post.imageUrl) || carEvent}
                          alt={post.title}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="flex flex-1 flex-col p-6">
                          <Badge variant="secondary">{formatDate(post.publishedAt)}</Badge>
                          <h3 className="mt-3 font-display text-2xl tracking-wider break-words">{post.title}</h3>
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                          <Button variant="outline" className="mt-auto w-full" asChild>
                            <Link to={`/blog/${post.id}`}>Read More</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Register{selectedEvent ? `: ${selectedEvent.title}` : ""}
            </DialogTitle>
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
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Ticket type</span>
                <span className="font-medium">
                  {selectedEvent?.priceCents ? `${formatCurrency(selectedEvent.priceCents)} each` : "Free"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{formatCurrency(totalAmountCents)}</span>
              </div>
              {isPaidEvent && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tickets are generated only after successful M-Pesa payment.
                </p>
              )}
            </div>
            {registerError && <p className="text-sm text-destructive">{registerError}</p>}
            {registerSuccess && <p className="text-sm text-emerald-500">{registerSuccess}</p>}
            {generatedTickets.length > 0 && (
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-sm font-medium">Ticket Codes</p>
                <div className="mt-2 space-y-1">
                  {generatedTickets.map((ticket) => (
                    <div key={ticket.id} className="text-sm font-mono">
                      {ticket.ticketNumber}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {registerSuccess ? (
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => void handlePrintTicket()}
                    disabled={generatedTickets.length === 0}
                  >
                    Print Ticket
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void handleDownloadTicket()}
                    disabled={generatedTickets.length === 0}
                  >
                    Download Ticket
                  </Button>
                </div>
                <Button variant="hero" onClick={() => setRegisterOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <Button variant="hero" onClick={submitRegistration} disabled={registerLoading || !!pendingRegistrationId}>
                {registerLoading
                  ? "Submitting..."
                  : pendingRegistrationId
                    ? "Waiting for Payment..."
                    : isPaidEvent
                      ? "Pay with M-Pesa"
                      : "Generate Ticket"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;
