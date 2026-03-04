import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdSlider from "@/components/services/AdSlider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, CheckCircle } from "lucide-react";
import serviceGarage from "@/assets/service-garage.jpg";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Service = {
  id: string;
  title: string;
  description: string | null;
  features: string[];
  priceCents: number | null;
  imageUrl: string | null;
  active: boolean;
};

const formatServicePrice = (priceCents: number | null) => {
  if (!priceCents) return "Custom Quote";
  return `KES ${(priceCents / 100).toLocaleString()}`;
};

const Services = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteName, setQuoteName] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch("/api/services?active=true");
        if (!resp.ok) throw new Error("Failed to load services");
        setServices(await resp.json());
      } catch (err) {
        setError("Unable to load services.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!bookingOpen) return;
    setBookingError(null);
    setBookingSuccess(null);
    setBookingName(user?.name || user?.email || "");
    setBookingPhone("");
    setBookingDate("");
    setBookingNotes("");
  }, [bookingOpen, user]);

  useEffect(() => {
    if (!quoteOpen) return;
    setQuoteError(null);
    setQuoteSuccess(null);
    setQuoteName(user?.name || user?.email || "");
    setQuotePhone("");
    setQuoteNotes("");
  }, [quoteOpen, user]);

  const openBooking = (service: Service) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setSelectedService(service);
    setBookingOpen(true);
  };

  const submitBooking = async () => {
    if (!selectedService) return;
    if (!bookingName.trim() || !bookingPhone.trim()) {
      setBookingError("Name and phone are required.");
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const resp = await apiFetch("/api/service-bookings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          serviceId: selectedService.id,
          contactName: bookingName,
          contactPhone: bookingPhone,
          scheduledDate: bookingDate || null,
          notes: bookingNotes || null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to book service");
      }

      setBookingSuccess("Booking submitted. We will contact you shortly.");
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Failed to book service.");
    } finally {
      setBookingLoading(false);
    }
  };

  const submitQuote = async () => {
    if (!quoteName.trim() || !quotePhone.trim()) {
      setQuoteError("Name and phone are required.");
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const resp = await apiFetch("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          inquiryType: "quote",
          name: quoteName,
          phone: quotePhone,
          message: quoteNotes || "Requesting a custom service quote.",
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit quote request");
      }
      setQuoteSuccess("Request submitted. We will contact you shortly.");
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setQuoteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Ad Slider */}
        <AdSlider />
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${serviceGarage})` }}
          >
            <div className="absolute inset-0 bg-background/90" />
          </div>
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="font-display text-5xl md:text-6xl tracking-wider animate-fade-in">
              EXPERT <span className="text-primary">SERVICES</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Professional automotive services by certified technicians. Your car deserves the best.
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {loading && <p className="text-muted-foreground">Loading services...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}
            {!loading && !error && services.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <p>No services available right now.</p>
                <Button variant="hero" size="sm" className="mt-4" onClick={() => setQuoteOpen(true)}>
                  Request a Quote
                </Button>
              </div>
            )}
            {!loading && !error && services.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {services.map((service, index) => (
                  <div
                    key={service.id}
                    className="group bg-card rounded-lg border border-border p-8 hover:border-primary/50 transition-all duration-500 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <Wrench className="w-7 h-7 text-primary-foreground" />
                    </div>

                    {service.imageUrl && (
                      <img
                        src={resolveImageUrl(service.imageUrl)}
                        alt={service.title}
                        className="w-full h-40 rounded-md object-cover border border-border mb-6"
                      />
                    )}

                    <h3 className="font-display text-2xl tracking-wider mb-3">{service.title}</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                      {service.description ?? "No description provided yet."}
                    </p>

                    {service.features.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {service.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center justify-between pt-6 border-t border-border">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          {service.priceCents ? "Starting at" : "Pricing"}
                        </p>
                        <span className="font-display text-xl text-primary">
                          {formatServicePrice(service.priceCents)}
                        </span>
                      </div>
                      <Button variant="hero" size="sm" onClick={() => openBooking(service)}>
                        Book Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-4xl tracking-wider">
              NEED A <span className="text-primary">CUSTOM QUOTE?</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Contact us for specialized services or custom build projects.
            </p>
            <Button variant="hero" size="xl" className="mt-8" onClick={() => setQuoteOpen(true)}>
              Get Quote
            </Button>
          </div>
        </section>
      </main>
      <Footer />

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Book Service{selectedService ? `: ${selectedService.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={bookingName} onChange={(e) => setBookingName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Preferred Date</Label>
              <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
            </div>
            {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}
            {bookingSuccess && <p className="text-sm text-emerald-500">{bookingSuccess}</p>}
          </div>
          <DialogFooter>
            {bookingSuccess ? (
              <Button variant="hero" onClick={() => setBookingOpen(false)}>
                Done
              </Button>
            ) : (
              <Button variant="hero" onClick={submitBooking} disabled={bookingLoading}>
                {bookingLoading ? "Submitting..." : "Submit Booking"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Custom Quote</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={quoteName} onChange={(e) => setQuoteName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={quotePhone} onChange={(e) => setQuotePhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} />
            </div>
            {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}
            {quoteSuccess && <p className="text-sm text-emerald-500">{quoteSuccess}</p>}
          </div>
          <DialogFooter>
            {quoteSuccess ? (
              <Button variant="hero" onClick={() => setQuoteOpen(false)}>
                Done
              </Button>
            ) : (
              <Button variant="hero" onClick={submitQuote} disabled={quoteLoading}>
                {quoteLoading ? "Submitting..." : "Submit Request"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
