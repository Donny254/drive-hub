import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Car, Fuel, Gauge, Calendar, DollarSign, MapPin } from "lucide-react";
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
  status?: "active" | "sold" | "inactive";
  location?: string | null;
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
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "paid" | "failed">("idle");
  const [bookingAvailability, setBookingAvailability] = useState<
    Array<{ startDate: string | null; endDate: string | null }>
  >([]);
  const [bankDetails, setBankDetails] = useState<{
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    branch?: string | null;
    swift?: string | null;
    instructions?: string | null;
  } | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
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
  }, [activeTab, search, year, minPrice, maxPrice, sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

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
    setBookingSuccess(null);
    setBookingPhone("");
    setBookingId(null);
    setPaymentStatus("idle");
    setBookingAvailability([]);
    setPurchaseSuccess(null);
    setPurchaseError(null);
    if (listing.listingType === "rent") {
      apiFetch(`/api/bookings/availability?listingId=${listing.id}`)
        .then((resp) => (resp.ok ? resp.json() : []))
        .then((data) => setBookingAvailability(Array.isArray(data) ? data : []))
        .catch(() => setBookingAvailability([]));
    }
    if (listing.listingType !== "rent") {
      apiFetch("/api/payments/bank-details")
        .then((resp) => (resp.ok ? resp.json() : null))
        .then((data) => setBankDetails(data))
        .catch(() => setBankDetails(null));
    }
  };

  const submitBooking = async () => {
    if (!bookingListing) return;
    if (bookingListing.listingType === "rent" && !bookingStart) {
      setBookingError("Start date is required.");
      return;
    }
    if (!bookingPhone.trim()) {
      setBookingError("Phone number is required.");
      return;
    }
    if (bookingListing.listingType === "rent") {
      const available = isRangeAvailable(bookingStart, bookingEnd || bookingStart);
      if (!available) {
        setBookingError("Selected dates are unavailable.");
        return;
      }
    }
    setBookingLoading(true);
    setBookingError(null);
    try {
      const effectiveStart =
        bookingListing.listingType === "rent" ? bookingStart : bookingStart || todayString;
      const effectiveEnd =
        bookingListing.listingType === "rent" ? bookingEnd || null : null;

      const resp = await apiFetch("/api/payments/mpesa/stkpush-booking", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          listingId: bookingListing.id,
          startDate: effectiveStart,
          endDate: effectiveEnd,
          phoneNumber: bookingPhone,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create booking");
      }

      const data = await resp.json().catch(() => ({}));
      setBookingId(data.bookingId || null);
      setPaymentStatus("pending");
      setBookingSuccess(
        data?.response?.CustomerMessage || "M-Pesa prompt sent. Complete the payment on your phone."
      );
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Failed to create booking.");
    } finally {
      setBookingLoading(false);
    }
  };

  const submitPurchaseInquiry = async () => {
    if (!bookingListing) return;
    if (!bookingPhone.trim()) {
      setPurchaseError("Phone number is required.");
      return;
    }
    setPurchaseLoading(true);
    setPurchaseError(null);
    try {
      const resp = await apiFetch("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({
          listingId: bookingListing.id,
          inquiryType: "listing",
          name: user?.name || user?.email || "Buyer",
          phone: bookingPhone,
          message: `Interested in buying: ${bookingListing.title}. Please share payment steps.`,
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit request");
      }
      setPurchaseSuccess("Request sent. Our team will contact you with payment instructions.");
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setPurchaseLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingListing || !bookingId || paymentStatus !== "pending") return;
    let active = true;

    const poll = async () => {
      const resp = await apiFetch(`/api/payments/mpesa/booking-status/${bookingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => null);
      if (!active || !data) return;
      const bookingPaymentStatus = data?.booking?.paymentStatus;
      const txStatus = data?.transaction?.status;
      if (bookingPaymentStatus === "paid" || txStatus === "paid") {
        setPaymentStatus("paid");
        setBookingSuccess("Payment received. Awaiting admin approval.");
      } else if (bookingPaymentStatus === "failed" || txStatus === "failed") {
        setPaymentStatus("failed");
        setBookingError("Payment failed or was cancelled.");
      }
    };

    const intervalId = window.setInterval(poll, 4000);
    poll();

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [bookingListing, bookingId, paymentStatus, token]);

  const computeDaysBetween = (start: string, end?: string | null) => {
    if (!start) return 1;
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = end ? new Date(`${end}T00:00:00`) : new Date(`${start}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  };


  const toInputDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseInputDate = (value?: string | null) => {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const todayString = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const todayDate = useMemo(() => new Date(`${todayString}T00:00:00`), [todayString]);

  const unavailableRanges = useMemo(() => {
    return bookingAvailability
      .map((range) => {
        const start = range.startDate ? new Date(`${range.startDate}T00:00:00`) : null;
        const end = range.endDate ? new Date(`${range.endDate}T00:00:00`) : null;
        const normalizedStart = start || end;
        const normalizedEnd = end || start;
        if (!normalizedStart || !normalizedEnd) return null;
        return { start: normalizedStart, end: normalizedEnd };
      })
      .filter(Boolean) as Array<{ start: Date; end: Date }>;
  }, [bookingAvailability]);

  const isDateDisabled = (date: Date, minDate?: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (day < todayDate) return true;
    if (minDate) {
      const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (day < min) return true;
    }
    return unavailableRanges.some((range) => day >= range.start && day <= range.end);
  };

  const isRangeAvailable = (start: string, end: string) => {
    if (!start) return false;
    const startKey = start;
    const endKey = end || start;
    return !bookingAvailability.some((range) => {
      const rangeStart = range.startDate || range.endDate || startKey;
      const rangeEnd = range.endDate || range.startDate || rangeStart;
      return startKey <= rangeEnd && endKey >= rangeStart;
    });
  };

  const totalDays = useMemo(() => {
    if (!bookingListing) return 1;
    if (bookingListing.listingType !== "rent") return 1;
    return computeDaysBetween(bookingStart, bookingEnd || bookingStart);
  }, [bookingListing, bookingStart, bookingEnd]);

  const totalPrice = bookingListing
    ? (bookingListing.priceCents / 100) * totalDays
    : 0;
  const isHighValue = bookingListing ? bookingListing.priceCents > 50000000 : false;

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
                      {listing.status && listing.status !== "active" && (
                        <Badge className="absolute bottom-4 left-4 capitalize" variant="secondary">
                          {listing.status === "sold" ? "Sold" : "Unavailable"}
                        </Badge>
                      )}
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
                      {listing.location && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-3">
                          <MapPin size={16} />
                          <span>{listing.location}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-6">
                        <div className="flex items-center gap-2">
                          <DollarSign className="text-primary" size={20} />
                          <span className="font-display text-2xl">
                            KES {(listing.priceCents / 100).toLocaleString()}
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
                          {(listing.listingType === "rent" || listing.listingType === "buy" || listing.listingType === "sell") && (
                            <Button
                              variant="hero"
                              size="sm"
                              onClick={() => openBooking(listing)}
                            >
                              {listing.listingType === "rent" ? "Rent Now" : "Buy Now"}
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
            <DialogTitle>
              {bookingListing?.listingType === "rent" ? "Rent" : "Buy"} {bookingListing?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {bookingListing?.listingType === "rent" && (
              <>
                <div className="grid gap-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="secondary"
                        className="justify-between"
                        type="button"
                      >
                        {bookingStart || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={parseInputDate(bookingStart)}
                        disabled={(date) => isDateDisabled(date)}
                        onSelect={(date) => {
                          if (!date) return;
                          const next = toInputDate(date);
                          setBookingStart(next);
                          if (bookingEnd && next && bookingEnd < next) {
                            setBookingEnd(next);
                          }
                        }}
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="secondary"
                        className="justify-between"
                        type="button"
                      >
                        {bookingEnd || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={parseInputDate(bookingEnd)}
                        disabled={(date) => isDateDisabled(date, parseInputDate(bookingStart))}
                        onSelect={(date) => {
                          if (!date) return;
                          const next = toInputDate(date);
                          if (bookingStart && next < bookingStart) return;
                          setBookingEnd(next);
                        }}
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {bookingStart && (
                  <div className="text-sm text-muted-foreground">
                    Duration:{" "}
                    <span className="font-medium text-foreground">
                      {totalDays} day{totalDays > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="grid gap-2">
              <Label>Phone (M-Pesa)</Label>
              <Input
                placeholder="07xx xxx xxx"
                value={bookingPhone}
                onChange={(e) => setBookingPhone(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span>Total</span>
              <span className="font-display text-xl text-primary">KES {totalPrice.toLocaleString()}</span>
            </div>
            {bookingListing?.listingType !== "rent" && isHighValue && (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Bank Transfer Required</p>
                <p className="mt-2">
                  This purchase exceeds the M-Pesa limit. Please use bank transfer or card.
                </p>
                <div className="mt-3 space-y-1">
                  {bankDetails?.bankName && <div>Bank: {bankDetails.bankName}</div>}
                  {bankDetails?.accountName && <div>Account Name: {bankDetails.accountName}</div>}
                  {bankDetails?.accountNumber && <div>Account No: {bankDetails.accountNumber}</div>}
                  {bankDetails?.branch && <div>Branch: {bankDetails.branch}</div>}
                  {bankDetails?.swift && <div>SWIFT: {bankDetails.swift}</div>}
                </div>
                {bankDetails?.instructions && (
                  <p className="mt-3 text-xs text-muted-foreground">{bankDetails.instructions}</p>
                )}
                {purchaseError && <p className="mt-2 text-sm text-destructive">{purchaseError}</p>}
                {purchaseSuccess && <p className="mt-2 text-sm text-emerald-500">{purchaseSuccess}</p>}
              </div>
            )}
            {bookingAvailability.length > 0 && bookingListing?.listingType === "rent" && (
              <p className="text-xs text-muted-foreground">
                Unavailable ranges:{" "}
                {bookingAvailability
                  .map((range) => `${range.startDate ?? "--"} to ${range.endDate ?? range.startDate ?? "--"}`)
                  .join(", ")}
              </p>
            )}
            {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}
            {bookingSuccess && <p className="text-sm text-emerald-500">{bookingSuccess}</p>}
            {paymentStatus === "pending" && (
              <p className="text-sm text-muted-foreground">Waiting for M-Pesa confirmation...</p>
            )}
          </div>
          <DialogFooter>
            {paymentStatus === "paid" ? (
              <Button variant="hero" onClick={() => setBookingListing(null)}>
                Done
              </Button>
            ) : bookingListing?.listingType !== "rent" && isHighValue ? (
              <Button variant="hero" onClick={submitPurchaseInquiry} disabled={purchaseLoading}>
                {purchaseLoading ? "Submitting..." : "Request Payment"}
              </Button>
            ) : (
              <Button variant="hero" onClick={submitBooking} disabled={bookingLoading}>
                {bookingLoading ? "Requesting..." : "Pay with M-Pesa"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Market;
