import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Car, Fuel, Gauge, MapPin, ShieldCheck, Store } from "lucide-react";
import { apiFetch, resolveImageUrl } from "@/lib/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=900";

type Listing = {
  id: string;
  title: string;
  priceCents: number;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "active" | "sold" | "inactive";
  location: string | null;
};

type Seller = {
  id: string;
  name: string;
  role: "user" | "admin";
  sellerVerificationStatus: "unverified" | "pending" | "verified";
  sellerVerifiedAt: string | null;
  createdAt: string;
  activeListingsCount: number;
  totalListingsCount: number;
  featuredListingsCount: number;
};

const formatMemberSince = (value?: string | null) => {
  if (!value) return "Recently joined";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently joined"
    : `Member since ${date.toLocaleDateString(undefined, { year: "numeric", month: "short" })}`;
};

const SellerProfile = () => {
  const { id } = useParams();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch(`/api/users/public/${id}`);
        if (!resp.ok) throw new Error("Failed to load seller");
        const data = await resp.json();
        setSeller(data.seller);
        setListings(Array.isArray(data.listings) ? data.listings : []);
      } catch (err) {
        console.error(err);
        setError("Seller storefront not found.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      load();
    }
  }, [id]);

  const trustLabel = useMemo(() => {
    if (!seller) return "Seller";
    if (seller.sellerVerificationStatus === "verified") return "Verified Seller";
    if (seller.activeListingsCount >= 3 || seller.role === "admin") return "Trusted Dealer";
    return "Private Seller";
  }, [seller]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {loading && <p className="text-muted-foreground">Loading seller storefront...</p>}
          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && seller && (
            <>
              <section className="rounded-3xl border border-border bg-card/80 p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Badge
                      variant={seller.sellerVerificationStatus === "verified" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {trustLabel}
                    </Badge>
                    <h1 className="mt-4 font-display text-4xl tracking-wider">{seller.name}</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                      Browse active vehicles from this seller. Use the storefront to compare inventory quality,
                      pricing consistency, and seller activity before contacting them.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {formatMemberSince(seller.createdAt)}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Store className="h-4 w-4 text-primary" />
                        Active Listings
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{seller.activeListingsCount}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Seller Status
                      </div>
                      <p className="mt-2 text-lg font-semibold">{trustLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        Featured Cars
                      </div>
                      <p className="mt-2 text-2xl font-semibold">{seller.featuredListingsCount}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl tracking-wider">Seller Inventory</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {listings.length} live listing{listings.length === 1 ? "" : "s"} available now.
                    </p>
                  </div>
                  <Link to="/market">
                    <Button variant="secondary">Back to Market</Button>
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50"
                    >
                      <img
                        src={resolveImageUrl(listing.imageUrl) || FALLBACK_IMAGE}
                        alt={listing.title}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-display text-2xl tracking-wider break-words">{listing.title}</h3>
                            <p className="mt-2 font-display text-2xl text-primary break-words">
                              KES {(listing.priceCents / 100).toLocaleString()}
                              {listing.listingType === "rent" && (
                                <span className="text-sm text-muted-foreground">/day</span>
                              )}
                            </p>
                          </div>
                          {listing.featured && <Badge>Featured</Badge>}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="min-w-0 break-words">{listing.year ?? "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            <span className="min-w-0 break-words">{listing.mileage ? `${listing.mileage.toLocaleString()} mi` : "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Fuel className="h-4 w-4" />
                            <span className="min-w-0 break-words">{listing.fuel ?? "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4" />
                            <span className="min-w-0 break-words">{listing.powerHp ? `${listing.powerHp} HP` : "N/A"}</span>
                          </div>
                        </div>

                        {listing.location && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="min-w-0 break-words">{listing.location}</span>
                          </div>
                        )}

                        <div className="mt-auto flex gap-2 pt-6">
                          <Link to={`/market/${listing.id}`} className="flex-1">
                            <Button variant="hero" className="w-full">
                              View Listing
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerProfile;
