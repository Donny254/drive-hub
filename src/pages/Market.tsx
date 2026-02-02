import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Fuel, Gauge, Calendar, DollarSign } from "lucide-react";
import MarketSlider from "@/components/market/MarketSlider";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl } from "@/lib/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600";

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
};

const tabs = [
  { id: "all", label: "All Cars" },
  { id: "buy", label: "Buy" },
  { id: "rent", label: "Rent" },
  { id: "sell", label: "Sell Yours" },
] as const;

const formatMileage = (listing: Listing) => {
  if (listing.listingType === "rent") return "Daily Rate";
  if (!listing.mileage) return "N/A";
  return `${listing.mileage.toLocaleString()} mi`;
};

const Market = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");

  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("status", "active");
      if (search.trim()) params.set("q", search.trim());
      if (activeTab !== "all") params.set("type", activeTab);
      if (year.trim()) params.set("year", year.trim());
      if (minPrice.trim()) params.set("minPrice", String(Math.round(Number(minPrice) * 100)));
      if (maxPrice.trim()) params.set("maxPrice", String(Math.round(Number(maxPrice) * 100)));
      if (sort === "price_asc") params.set("sort", "price_asc");
      if (sort === "price_desc") params.set("sort", "price_desc");
      if (sort === "year_desc") params.set("sort", "year_desc");

      const resp = await apiFetch(`/api/listings?${params.toString()}`);
      if (!resp.ok) {
        throw new Error("Failed to load listings");
      }
      const data = (await resp.json()) as Listing[];
      setListings(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load listings right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [activeTab, search, year, minPrice, maxPrice, sort]);

  const filteredListings = useMemo(() => listings, [listings]);

  const openBooking = (listing: Listing) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setBookingListing(listing);
    setBookingStart("");
    setBookingEnd("");
    setBookingError(null);
  };

  const submitBooking = async () => {
    if (!bookingListing) return;
    if (!bookingStart) {
      setBookingError("Start date is required.");
      return;
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const resp = await apiFetch("/api/bookings", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          listingId: bookingListing.id,
          startDate: bookingStart,
          endDate: bookingEnd || null,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create booking");
      }

      setBookingListing(null);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Failed to create booking.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Ad Slider Banner */}
        <MarketSlider />

        {/* Filter Tabs */}
        <section className="py-8 bg-secondary/50 border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl tracking-wider">
                  EXPLORE OUR <span className="text-primary">COLLECTION</span>
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Premium vehicles for Kenya's most discerning clients
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "hero" : "secondary"}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search by name, brand, type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div>
                <Label>Min Price</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Max Price</Label>
                <Input
                  type="number"
                  placeholder="200000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Sort</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="year_desc">Year: Newest</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Car Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {loading && (
              <div className="text-center text-muted-foreground">Loading listings...</div>
            )}
            {!loading && error && (
              <div className="text-center space-y-4">
                <p className="text-destructive">{error}</p>
                <Button variant="secondary" onClick={fetchListings}>
                  Try Again
                </Button>
              </div>
            )}
            {!loading && !error && filteredListings.length === 0 && (
              <div className="text-center text-muted-foreground">
                No listings available yet.
              </div>
            )}

            {!loading && !error && filteredListings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredListings.map((listing, index) => (
                  <div
                    key={listing.id}
                    className="group bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-500 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Image */}
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={resolveImageUrl(listing.imageUrl) || FALLBACK_IMAGE}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {listing.featured && (
                        <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                          Featured
                        </Badge>
                      )}
                      <Badge
                        className="absolute top-4 right-4 capitalize"
                        variant={listing.listingType === "rent" ? "secondary" : "outline"}
                      >
                        {listing.listingType === "sell" ? "For Sale" : listing.listingType}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="font-display text-2xl tracking-wider">{listing.title}</h3>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar size={16} />
                          <span>{listing.year ?? "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Car size={16} />
                          <span>{formatMileage(listing)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Fuel size={16} />
                          <span>{listing.fuel ?? "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Gauge size={16} />
                          <span>{listing.powerHp ? `${listing.powerHp} HP` : "N/A"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-6">
                        <div className="flex items-center gap-1">
                          <DollarSign className="text-primary" size={20} />
                          <span className="font-display text-2xl">
                            {(listing.priceCents / 100).toLocaleString()}
                            {listing.listingType === "rent" && (
                              <span className="text-sm text-muted-foreground">/day</span>
                            )}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/market/${listing.id}`)}
                          >
                            View Details
                          </Button>
                          {listing.listingType === "rent" && (
                            <Button
                              variant="hero"
                              size="sm"
                              onClick={() => openBooking(listing)}
                            >
                              Rent Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sell CTA */}
        <section className="py-16 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-4xl tracking-wider">
              WANT TO <span className="text-primary">SELL YOUR CAR?</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              List your vehicle with us and reach thousands of potential buyers.
            </p>
            <Button variant="hero" size="xl" className="mt-8">
              List Your Car
            </Button>
          </div>
        </section>
      </main>
      <Footer />

      <Dialog open={Boolean(bookingListing)} onOpenChange={() => setBookingListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book {bookingListing?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={bookingStart}
                onChange={(e) => setBookingStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={bookingEnd}
                onChange={(e) => setBookingEnd(e.target.value)}
              />
            </div>
            {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}
          </div>
          <DialogFooter>
            <Button variant="hero" onClick={submitBooking} disabled={bookingLoading}>
              {bookingLoading ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Market;
