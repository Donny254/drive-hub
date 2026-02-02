import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Car, Fuel, Gauge, MapPin } from "lucide-react";
import { apiFetch, resolveImageUrl } from "@/lib/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1200";

type Listing = {
  id: string;
  title: string;
  priceCents: number;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  images?: Array<{ id: string; url: string }>;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "active" | "sold" | "inactive";
  description: string | null;
  location: string | null;
};

const ListingDetails = () => {
  const { id } = useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch(`/api/listings/${id}`);
        if (!resp.ok) throw new Error("Failed to load listing");
        setListing(await resp.json());
      } catch (err) {
        setError("Listing not found.");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  useEffect(() => {
    const loadSimilar = async () => {
      if (!listing) return;
      try {
        const resp = await apiFetch(`/api/listings?status=active&type=${listing.listingType}&limit=8`);
        if (!resp.ok) return;
        const data = (await resp.json()) as Listing[];
        const filtered = data.filter((item) => item.id !== listing.id).slice(0, 3);
        setSimilarListings(filtered);
      } catch {
        setSimilarListings([]);
      }
    };
    loadSimilar();
  }, [listing]);

  const galleryImages = useMemo(() => {
    if (!listing) return [];
    const list = listing.images?.map((img) => resolveImageUrl(img.url)) ?? [];
    const primary = resolveImageUrl(listing.imageUrl) || FALLBACK_IMAGE;
    const merged = [primary, ...list.filter((url) => url !== primary)];
    return merged.length > 0 ? merged : [FALLBACK_IMAGE];
  }, [listing]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) return;
    setSending(true);
    setSent(false);
    setSendError(null);
    try {
      const resp = await apiFetch("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          listingId: listing?.id,
          inquiryType: "listing",
          name: contactName,
          email: contactEmail,
          message: contactMessage || "Interested in this listing.",
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to send inquiry");
      }
      setSent(true);
      setContactMessage("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send inquiry.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {loading && <p className="text-muted-foreground">Loading listing...</p>}
          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && listing && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-border">
                    <img
                      src={resolveImageUrl(listing.imageUrl) || FALLBACK_IMAGE}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      {listing.featured && (
                        <Badge className="bg-primary text-primary-foreground">Featured</Badge>
                      )}
                      <Badge variant="secondary" className="capitalize">
                        {listing.listingType === "sell" ? "For Sale" : listing.listingType}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {galleryImages.map((img, idx) => (
                      <img
                        key={`${img}-${idx}`}
                        src={img}
                        alt={`${listing.title} ${idx + 1}`}
                        className="h-24 w-full rounded-md object-cover border border-border"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h1 className="font-display text-4xl tracking-wider">{listing.title}</h1>
                    <p className="text-primary font-display text-3xl mt-2">
                      {(listing.priceCents / 100).toLocaleString()}
                      {listing.listingType === "rent" && (
                        <span className="text-sm text-muted-foreground">/day</span>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>{listing.year ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car size={16} />
                      <span>{listing.mileage ? `${listing.mileage.toLocaleString()} mi` : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Fuel size={16} />
                      <span>{listing.fuel ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge size={16} />
                      <span>{listing.powerHp ? `${listing.powerHp} HP` : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin size={16} />
                      <span>{listing.location ?? "N/A"}</span>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-display text-lg tracking-wider">Description</h3>
                    <p className="text-muted-foreground mt-2">
                      {listing.description ?? "No description provided yet."}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Link to="/market">
                      <Button variant="secondary">Back to Market</Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="font-display text-xl tracking-wider">Contact Seller</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Send a message to the seller for availability and inspection.
                    </p>
                    <form className="mt-4 grid gap-4" onSubmit={submitContact}>
                      <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Message</Label>
                        <Textarea
                          rows={4}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Hi, is this vehicle still available?"
                        />
                      </div>
                      {sendError && <p className="text-sm text-destructive">{sendError}</p>}
                      {sent && (
                        <p className="text-sm text-success">
                          Message sent! The seller will contact you shortly.
                        </p>
                      )}
                      <Button variant="hero" type="submit" disabled={sending}>
                        {sending ? "Sending..." : "Send Message"}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-display text-xl tracking-wider">Similar Listings</h3>
                  {similarListings.length === 0 && (
                    <p className="text-muted-foreground text-sm">No similar listings yet.</p>
                  )}
                  {similarListings.map((item) => (
                    <Link to={`/market/${item.id}`} key={item.id}>
                      <div className="flex gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition">
                        <img
                          src={resolveImageUrl(item.imageUrl) || FALLBACK_IMAGE}
                          alt={item.title}
                          className="h-16 w-20 rounded-md object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-display text-base">{item.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {item.listingType} • {(item.priceCents / 100).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ListingDetails;
