import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Car, Fuel, Gauge, MapPin, ShieldCheck, Store } from "lucide-react";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1200";
const LISTING_VIEWER_KEY_STORAGE = "drive-hub-listing-viewer-key";

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
  seller?: {
    id: string;
    name: string;
    role: "user" | "admin";
    createdAt: string | null;
    activeListingsCount: number;
    trustLevel: "verified" | "dealer" | "private";
  } | null;
};

const formatMemberSince = (value?: string | null) => {
  if (!value) return "Recently joined";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently joined"
    : `Member since ${date.toLocaleDateString(undefined, { year: "numeric", month: "short" })}`;
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

  useEffect(() => {
    if (!listing?.id || typeof window === "undefined") return;

    let viewerKey = window.localStorage.getItem(LISTING_VIEWER_KEY_STORAGE);
    if (!viewerKey) {
      viewerKey = crypto.randomUUID();
      window.localStorage.setItem(LISTING_VIEWER_KEY_STORAGE, viewerKey);
    }

    apiFetch(`/api/listings/${listing.id}/view`, {
      method: "POST",
      body: JSON.stringify({ viewerKey }),
    }).catch(() => undefined);
  }, [listing?.id]);

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
        throw new Error(await getApiErrorMessage(resp, "Failed to send inquiry"));
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
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border">
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    <h1 className="font-display text-4xl tracking-wider break-words">{listing.title}</h1>
                    <p className="mt-2 font-display text-3xl text-primary break-words">
                      KES {(listing.priceCents / 100).toLocaleString()}
                      {listing.listingType === "rent" && (
                        <span className="text-sm text-muted-foreground">/day</span>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span className="min-w-0 break-words">{listing.year ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car size={16} />
                      <span className="min-w-0 break-words">{listing.mileage ? `${listing.mileage.toLocaleString()} mi` : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Fuel size={16} />
                      <span className="min-w-0 break-words">{listing.fuel ?? "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge size={16} />
                      <span className="min-w-0 break-words">{listing.powerHp ? `${listing.powerHp} HP` : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <MapPin size={16} />
                      <span className="min-w-0 break-words">{listing.location ?? "N/A"}</span>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-display text-lg tracking-wider">Description</h3>
                    <p className="text-muted-foreground mt-2">
                      {listing.description ?? "No description provided yet."}
                    </p>
                  </div>

                  {listing.seller && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="font-display text-lg tracking-wider">Seller Profile</h3>
                          <p className="mt-2 text-base font-medium text-foreground break-words">{listing.seller.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatMemberSince(listing.seller.createdAt)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            listing.seller.trustLevel === "verified" || listing.seller.trustLevel === "dealer"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {listing.seller.trustLevel === "verified"
                            ? "Verified Seller"
                            : listing.seller.trustLevel === "dealer"
                              ? "Trusted Dealer"
                              : "Private Seller"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background/60 p-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Store size={16} className="text-primary" />
                            Active Listings
                          </div>
                          <p className="mt-2 text-lg font-semibold">{listing.seller.activeListingsCount}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 p-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ShieldCheck size={16} className="text-primary" />
                            Trust Signal
                          </div>
                          <p className="mt-2 text-lg font-semibold">
                            {listing.seller.trustLevel === "verified"
                              ? "Admin verified seller"
                              : listing.seller.trustLevel === "dealer"
                                ? "Higher inventory seller"
                                : "Single-owner listing"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Link to={`/sellers/${listing.seller.id}`}>
                          <Button variant="secondary">View Seller Storefront</Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link to="/market">
                      <Button variant="secondary">Back to Market</Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
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
                      <div className="flex gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/50">
                        <img
                          src={resolveImageUrl(item.imageUrl) || FALLBACK_IMAGE}
                          alt={item.title}
                          className="h-16 w-20 rounded-md object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base break-words">{item.title}</p>
                          <p className="text-sm text-muted-foreground capitalize break-words">
                            {item.listingType} - KES {(item.priceCents / 100).toLocaleString()}
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
