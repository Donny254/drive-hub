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
};

type BlogPost = {
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
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
  const [registerLoading, setRegisterLoading] = useState(false);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

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
  }, [registerOpen, user]);

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

      setRegisterSuccess("Registration submitted. We will contact you soon.");
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border border-border rounded-2xl overflow-hidden">
                    <img
                      src={resolveImageUrl(featuredEvent.imageUrl) || carEvent}
                      alt={featuredEvent.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="p-8 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                        <Badge variant={statusBadgeVariant(featuredEvent.status)} className="capitalize">
                          {featuredEvent.status}
                        </Badge>
                      </div>
                      <h2 className="font-display text-4xl tracking-wider">{featuredEvent.title}</h2>
                      <p className="text-muted-foreground">{featuredEvent.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          {formatDateRange(featuredEvent.startDate, featuredEvent.endDate)}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          {featuredEvent.location ?? "TBA"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {otherEvents.map((event) => (
                      <div key={event.id} className="bg-card border border-border rounded-xl overflow-hidden">
                        <img
                          src={resolveImageUrl(event.imageUrl) || carEvent}
                          alt={event.title}
                          className="w-full h-56 object-cover"
                        />
                        <div className="p-6 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {formatDateRange(event.startDate, event.endDate)}
                            </Badge>
                            <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
                              {event.status}
                            </Badge>
                          </div>
                          <h3 className="font-display text-2xl tracking-wider">{event.title}</h3>
                          <p className="text-muted-foreground text-sm line-clamp-3">
                            {event.description}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin size={14} />
                            {event.location ?? "TBA"}
                          </div>
                          <Button variant="outline" className="w-full" asChild>
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-card border border-border rounded-2xl overflow-hidden">
                    <img
                      src={resolveImageUrl(featuredPost.imageUrl) || carEvent}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="p-8 space-y-4">
                      <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                      <h2 className="font-display text-4xl tracking-wider">{featuredPost.title}</h2>
                      <p className="text-muted-foreground">{featuredPost.excerpt}</p>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(featuredPost.publishedAt)}
                      </div>
                      <Button variant="hero" asChild>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {otherPosts.map((post) => (
                      <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden">
                        <img
                          src={resolveImageUrl(post.imageUrl) || carEvent}
                          alt={post.title}
                          className="w-full h-56 object-cover"
                        />
                        <div className="p-6 space-y-3">
                          <Badge variant="secondary">{formatDate(post.publishedAt)}</Badge>
                          <h3 className="font-display text-2xl tracking-wider">{post.title}</h3>
                          <p className="text-muted-foreground text-sm line-clamp-3">{post.excerpt}</p>
                          <Button variant="outline" className="w-full" asChild>
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

export default Events;
