import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDown, ArrowUp, BookmarkPlus, Calendar, Car, DollarSign, Fuel, Gauge, MapPin, Scale, ShieldCheck, X } from "lucide-react";
import MarketSlider from "@/components/market/MarketSlider";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/lib/feedback";
import { isEndBeforeStart, isPastDateValue } from "@/lib/date";
import CryptoProofUploader from "@/components/shared/CryptoProofUploader";
import CryptoPaymentTimeline from "@/components/shared/CryptoPaymentTimeline";
import CryptoPaymentDetails from "@/components/shared/CryptoPaymentDetails";
import useCryptoPaymentStatus from "@/hooks/useCryptoPaymentStatus";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=600";
const SHORTLIST_STORAGE_KEY = "drive-hub-market-shortlist";

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
  seller?: {
    id: string;
    name: string;
    role: "user" | "admin";
    createdAt: string | null;
    activeListingsCount: number;
    trustLevel: "verified" | "dealer" | "private";
  } | null;
};

type SavedSearch = {
  id: string;
  name: string;
  filters: {
    activeTab: string;
    search: string;
    year: string;
    minPrice: string;
    maxPrice: string;
    sort: string;
  };
};

type CryptoDetails = {
  asset: string;
  network: string | null;
  walletAddress: string | null;
  instructions: string | null;
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
  const [shortlist, setShortlist] = useState<Listing[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  const [bookingListing, setBookingListing] = useState<Listing | null>(null);
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "paid" | "failed">("idle");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [cryptoDetails, setCryptoDetails] = useState<CryptoDetails | null>(null);
  const [transactionHash, setTransactionHash] = useState("");
  const [payerWallet, setPayerWallet] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
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

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const bookingDialogRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = user?.role === "admin";

  const {
    data: cryptoStatusData,
    loading: cryptoStatusLoading,
    error: cryptoStatusError,
    refresh: refreshCryptoStatus,
  } = useCryptoPaymentStatus(
    bookingId ? `/api/payments/crypto/booking-status/${bookingId}` : null,
    Boolean(bookingListing && paymentMethod === "crypto" && bookingId),
    5000,
    authHeaders
  );

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
        throw new Error(await getApiErrorMessage(resp, "Failed to load listings"));
      }
      const data = (await resp.json()) as Listing[];
      setListings(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load listings right now.");
      toast.error("Unable to load listings right now.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, year, minPrice, maxPrice, sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const loadCryptoDetails = async () => {
      try {
        const resp = await apiFetch("/api/payments/crypto-details");
        if (resp.ok) {
          setCryptoDetails(await resp.json().catch(() => null));
        } else {
          setCryptoDetails(null);
        }
      } catch (err) {
        console.error("Failed to load crypto details", err);
        setCryptoDetails(null);
      }
    };
    void loadCryptoDetails();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setShortlist(parsed);
      }
    } catch {
      window.localStorage.removeItem(SHORTLIST_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(shortlist));
  }, [shortlist]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("drive-hub-saved-searches");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedSearches(parsed);
      }
    } catch {
      window.localStorage.removeItem("drive-hub-saved-searches");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("drive-hub-saved-searches", JSON.stringify(savedSearches));
  }, [savedSearches]);

  const filteredListings = useMemo(() => listings, [listings]);
  const shortlistIds = useMemo(() => new Set(shortlist.map((item) => item.id)), [shortlist]);

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
    setPaymentMethod("mpesa");
    setTransactionHash("");
    setPayerWallet("");
    setProofImageUrl(null);
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
      toast.error("Start date is required.");
      return;
    }
    if (bookingListing.listingType === "rent" && isPastDateValue(bookingStart)) {
      setBookingError("Start date cannot be in the past.");
      toast.error("Start date cannot be in the past.");
      return;
    }
    if (bookingListing.listingType === "rent" && bookingEnd && isPastDateValue(bookingEnd)) {
      setBookingError("End date cannot be in the past.");
      toast.error("End date cannot be in the past.");
      return;
    }
    if (bookingListing.listingType === "rent" && isEndBeforeStart(bookingStart, bookingEnd || bookingStart)) {
      setBookingError("End date must be on or after the start date.");
      toast.error("End date must be on or after the start date.");
      return;
    }
    if (!bookingPhone.trim()) {
      setBookingError("Phone number is required.");
      toast.error("Phone number is required.");
      return;
    }
    if (bookingListing.listingType === "rent" && paymentMethod === "crypto" && !transactionHash.trim()) {
      setBookingError("Transaction hash is required for crypto payment.");
      toast.error("Transaction hash is required for crypto payment.");
      return;
    }
    if (bookingListing.listingType === "rent" && paymentMethod === "crypto" && !proofImageUrl) {
      setBookingError("Payment proof image is required for crypto payment.");
      toast.error("Payment proof image is required for crypto payment.");
      return;
    }
    if (bookingListing.listingType === "rent") {
      const available = isRangeAvailable(bookingStart, bookingEnd || bookingStart);
      if (!available) {
        setBookingError("Selected dates are unavailable.");
        toast.error("Selected dates are unavailable.");
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

      const endpoint =
        paymentMethod === "crypto"
          ? "/api/payments/crypto/booking"
          : "/api/payments/mpesa/stkpush-booking";
      const resp = await apiFetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          listingId: bookingListing.id,
          startDate: effectiveStart,
          endDate: effectiveEnd,
          phoneNumber: bookingPhone,
          transactionHash,
          payerWallet,
          proofImageUrl,
          asset: cryptoDetails?.asset,
          network: cryptoDetails?.network,
        }),
      });

      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Failed to create booking"));
      }

      const data = await resp.json().catch(() => ({}));
      setBookingId(data.bookingId || null);
      setPaymentStatus(paymentMethod === "crypto" ? "idle" : "pending");
      setBookingSuccess(
        paymentMethod === "crypto"
          ? data?.message || "Crypto payment submitted for review."
          : data?.response?.CustomerMessage || "M-Pesa prompt sent. Complete the payment on your phone."
      );
      toast.success(
        paymentMethod === "crypto"
          ? data?.message || "Crypto payment submitted for review."
          : data?.response?.CustomerMessage || "M-Pesa prompt sent. Complete payment on your phone."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create booking.";
      setBookingError(message);
      toast.error(message);
    } finally {
      setBookingLoading(false);
    }
  };

  const submitPurchaseInquiry = async () => {
    if (!bookingListing) return;
    if (!bookingPhone.trim()) {
      setPurchaseError("Phone number is required.");
      toast.error("Phone number is required.");
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
        throw new Error(await getApiErrorMessage(resp, "Failed to submit request"));
      }
      setPurchaseSuccess("Request sent. Our team will contact you with payment instructions.");
      toast.success("Request sent. Our team will contact you with payment instructions.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit request.";
      setPurchaseError(message);
      toast.error(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingListing || !bookingId || paymentStatus !== "pending" || paymentMethod !== "mpesa") return;
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
        toast.success("Payment received. Awaiting admin approval.");
      } else if (bookingPaymentStatus === "failed" || txStatus === "failed") {
        setPaymentStatus("failed");
        setBookingError("Payment failed or was cancelled.");
        toast.error("Payment failed or was cancelled.");
      }
    };

    const intervalId = window.setInterval(poll, 4000);
    poll();

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [bookingListing, bookingId, paymentMethod, paymentStatus, token]);

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
  const bookingBasePrice = bookingListing
    ? bookingListing.listingType === "rent"
      ? `${(bookingListing.priceCents / 100).toLocaleString()} / day`
      : `KES ${(bookingListing.priceCents / 100).toLocaleString()}`
    : "KES 0";
  const scrollBookingDialog = (direction: "top" | "bottom") => {
    if (!bookingDialogRef.current) return;
    bookingDialogRef.current.scrollTo({
      top: direction === "top" ? 0 : bookingDialogRef.current.scrollHeight,
      behavior: "smooth",
    });
  };
  const clearFilters = () => {
    setSearch("");
    setYear("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setActiveTab("all");
  };

  const toggleShortlist = (listing: Listing) => {
    setShortlist((current) => {
      if (current.some((item) => item.id === listing.id)) {
        toast.success(`${listing.title} removed from shortlist.`);
        return current.filter((item) => item.id !== listing.id);
      }
      if (current.length >= 3) {
        toast.success(`${listing.title} added to shortlist.`);
        return [...current.slice(1), listing];
      }
      toast.success(`${listing.title} added to shortlist.`);
      return [...current, listing];
    });
  };

  const saveCurrentSearch = () => {
    const hasFilters =
      activeTab !== "all" || search.trim() || year.trim() || minPrice.trim() || maxPrice.trim() || sort !== "newest";
    if (!hasFilters) return;
    const name =
      search.trim() ||
      [activeTab !== "all" ? activeTab.toUpperCase() : "", year.trim() ? year.trim() : "", sort !== "newest" ? sort : ""]
        .filter(Boolean)
        .join(" ") ||
      `Search ${savedSearches.length + 1}`;

    const next: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      filters: { activeTab, search, year, minPrice, maxPrice, sort },
    };
    setSavedSearches((current) => [next, ...current].slice(0, 6));
  };

  const applySavedSearch = (savedSearch: SavedSearch) => {
    setActiveTab(savedSearch.filters.activeTab);
    setSearch(savedSearch.filters.search);
    setYear(savedSearch.filters.year);
    setMinPrice(savedSearch.filters.minPrice);
    setMaxPrice(savedSearch.filters.maxPrice);
    setSort(savedSearch.filters.sort);
  };

  const removeSavedSearch = (id: string) => {
    setSavedSearches((current) => current.filter((item) => item.id !== id));
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
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Buy with more confidence
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Shortlist up to three cars, compare specs side by side, and use M-Pesa or bank transfer flow based on ticket size. This follows the trust-first pattern used by leading auto marketplaces.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Compare shortlist</p>
                    <p className="text-xs text-muted-foreground">
                      {shortlist.length}/3 vehicles selected
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCompareOpen(true)}
                    disabled={shortlist.length < 2}
                  >
                    <Scale className="mr-2 h-4 w-4" />
                    Compare
                  </Button>
                </div>
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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{filteredListings.length} results</Badge>
              <Button variant="ghost" size="sm" onClick={saveCurrentSearch}>
                Save search
              </Button>
              {(search || year || minPrice || maxPrice || activeTab !== "all" || sort !== "newest") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
            {savedSearches.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
                <p className="text-sm font-medium text-foreground">Saved searches</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {savedSearches.map((savedSearch) => (
                    <div key={savedSearch.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
                      <button type="button" onClick={() => applySavedSearch(savedSearch)} className="hover:text-primary">
                        {savedSearch.name}
                      </button>
                      <button type="button" onClick={() => removeSavedSearch(savedSearch.id)} aria-label={`Remove ${savedSearch.name}`}>
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((listing, index) => (
                  <div
                    key={listing.id}
                    className="group flex h-full flex-col rounded-lg border border-border bg-card transition-all duration-500 hover:border-primary/50 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
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
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute bottom-4 right-4"
                        onClick={() => toggleShortlist(listing)}
                      >
                        <BookmarkPlus className="mr-2 h-4 w-4" />
                        {shortlistIds.has(listing.id) ? "Shortlisted" : "Shortlist"}
                      </Button>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-2xl tracking-wider break-words">{listing.title}</h3>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar size={16} />
                          <span className="min-w-0 break-words">{listing.year ?? "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Car size={16} />
                          <span className="min-w-0 break-words">{formatMileage(listing)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Fuel size={16} />
                          <span className="min-w-0 break-words">{listing.fuel ?? "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Gauge size={16} />
                          <span className="min-w-0 break-words">{listing.powerHp ? `${listing.powerHp} HP` : "N/A"}</span>
                        </div>
                      </div>
                      {listing.location && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-3">
                          <MapPin size={16} />
                          <span className="min-w-0 break-words">{listing.location}</span>
                        </div>
                      )}
                      {listing.seller && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary" className="capitalize">
                            {listing.seller.trustLevel === "verified"
                              ? "Verified Seller"
                              : listing.seller.trustLevel === "dealer"
                                ? "Trusted Dealer"
                                : "Private Seller"}
                          </Badge>
                          <Link
                            to={`/sellers/${listing.seller.id}`}
                            className="min-w-0 break-words text-muted-foreground hover:text-primary"
                          >
                            {listing.seller.name} • {listing.seller.activeListingsCount} active listing{listing.seller.activeListingsCount === 1 ? "" : "s"}
                          </Link>
                        </div>
                      )}

                      <div className="mt-auto flex flex-col gap-4 pt-6">
                        <div className="flex items-start gap-2">
                          <DollarSign className="text-primary" size={20} />
                          <span className="font-display text-2xl leading-tight break-words">
                            KES {(listing.priceCents / 100).toLocaleString()}
                            {listing.listingType === "rent" && (
                              <span className="text-sm text-muted-foreground">/day</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full sm:flex-1"
                            onClick={() => navigate(`/market/${listing.id}`)}
                          >
                            View Details
                          </Button>
                          {(listing.listingType === "rent" || listing.listingType === "buy" || listing.listingType === "sell") && (
                            <Button
                              variant="hero"
                              size="sm"
                              className="w-full sm:flex-1"
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

      {shortlist.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Shortlisted for comparison</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {shortlist.map((item) => (
                  <Badge key={item.id} variant="secondary" className="gap-2 px-3 py-1">
                    {item.title}
                    <button type="button" onClick={() => toggleShortlist(item)} aria-label={`Remove ${item.title}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShortlist([])}>
                Clear
              </Button>
              <Button variant="hero" onClick={() => setCompareOpen(true)} disabled={shortlist.length < 2}>
                <Scale className="mr-2 h-4 w-4" />
                Compare Vehicles
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Compare Vehicles</DialogTitle>
            <DialogDescription>
              Review shortlisted vehicles side by side to compare price, specs, and location before choosing one to view or purchase.
            </DialogDescription>
          </DialogHeader>
              <div className="grid gap-4 overflow-x-auto lg:grid-cols-3">
            {shortlist.map((item) => (
              <div key={item.id} className="flex h-full min-w-[260px] flex-col rounded-xl border border-border bg-card p-4">
                <img
                  src={resolveImageUrl(item.imageUrl) || FALLBACK_IMAGE}
                  alt={item.title}
                  className="h-40 w-full rounded-lg object-cover"
                />
                <h3 className="mt-4 font-display text-2xl tracking-wider break-words">{item.title}</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Price</span><span className="text-right break-words">KES {(item.priceCents / 100).toLocaleString()}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Type</span><span className="capitalize text-right break-words">{item.listingType}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Year</span><span className="text-right break-words">{item.year ?? "N/A"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Mileage</span><span className="text-right break-words">{formatMileage(item)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fuel</span><span className="text-right break-words">{item.fuel ?? "N/A"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Power</span><span className="text-right break-words">{item.powerHp ? `${item.powerHp} HP` : "N/A"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Location</span><span className="text-right break-words">{item.location ?? "TBA"}</span></div>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
                  <Button variant="secondary" size="sm" className="w-full sm:flex-1" onClick={() => navigate(`/market/${item.id}`)}>
                    View Details
                  </Button>
                  <Button variant="hero" size="sm" className="w-full sm:flex-1" onClick={() => openBooking(item)}>
                    {item.listingType === "rent" ? "Rent" : "Buy"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(bookingListing)} onOpenChange={() => setBookingListing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" ref={bookingDialogRef}>
          <DialogHeader>
            <DialogTitle>
              {bookingListing?.listingType === "rent" ? "Rent" : "Buy"} {bookingListing?.title}
            </DialogTitle>
            <DialogDescription>
              Confirm your booking or purchase details below. Rental requests collect dates, proof, and payment details, while high-value purchases switch to a manual payment request flow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollBookingDialog("top")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Scroll to top
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollBookingDialog("bottom")}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Scroll to payment
              </Button>
            </div>
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
              <Label>Phone</Label>
              <Input
                placeholder="07xx xxx xxx"
                value={bookingPhone}
                onChange={(e) => setBookingPhone(e.target.value)}
              />
            </div>
            <div className="rounded-md border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Base price</span>
                <span className="font-medium">{bookingBasePrice}</span>
              </div>
              {bookingListing?.listingType === "rent" && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {totalDays} day{totalDays > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium capitalize">{paymentMethod}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="font-medium">Total</span>
                <span className="font-semibold text-primary">KES {totalPrice.toLocaleString()}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "mpesa" | "crypto")}
              >
                <option value="mpesa">M-Pesa</option>
                <option value="crypto">Crypto</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {paymentMethod === "crypto"
                  ? "Crypto payments are reviewed manually after proof and transaction details are submitted."
                  : "M-Pesa sends a payment prompt to your phone for instant confirmation."}
              </p>
            </div>
            {paymentMethod === "crypto" && (
              <CryptoPaymentDetails
                asset={cryptoDetails?.asset}
                network={cryptoDetails?.network}
                walletAddress={cryptoDetails?.walletAddress}
                instructions={cryptoDetails?.instructions}
                showAdminShortcut={isAdmin}
              />
            )}
            {paymentMethod === "crypto" && (
              <div className="grid gap-4">
                <CryptoProofUploader
                  token={token}
                  proofImageUrl={proofImageUrl}
                  onProofImageUrlChange={setProofImageUrl}
                  label="Payment proof"
                  description="Upload a clear transfer screenshot or receipt before submitting."
                />
                <div className="grid gap-2">
                  <Label>Transaction Hash</Label>
                  <Input value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Payer Wallet (optional)</Label>
                  <Input value={payerWallet} onChange={(e) => setPayerWallet(e.target.value)} />
                </div>
              </div>
            )}
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
            <div className="sticky bottom-4 z-20 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollBookingDialog("top")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Back to top
              </Button>
            </div>
            {paymentMethod === "crypto" && bookingId && (
              <CryptoPaymentTimeline
                resource={cryptoStatusData?.resource || null}
                transaction={cryptoStatusData?.transaction || null}
                loading={cryptoStatusLoading}
                error={cryptoStatusError}
                onRefresh={refreshCryptoStatus}
                refreshing={cryptoStatusLoading}
              />
            )}
            {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}
            {bookingSuccess && <p className="text-sm text-emerald-500">{bookingSuccess}</p>}
            {paymentStatus === "pending" && paymentMethod === "mpesa" && (
              <p className="text-sm text-muted-foreground">Waiting for M-Pesa confirmation...</p>
            )}
          </div>
          <DialogFooter>
            {paymentStatus === "paid" || (bookingListing?.listingType === "rent" && paymentMethod === "crypto" && bookingSuccess) ? (
              <Button variant="hero" onClick={() => setBookingListing(null)}>
                Done
              </Button>
            ) : bookingListing?.listingType !== "rent" && isHighValue ? (
              <Button variant="hero" onClick={submitPurchaseInquiry} disabled={purchaseLoading}>
                {purchaseLoading ? "Submitting..." : "Request Payment"}
              </Button>
            ) : (
              <Button variant="hero" onClick={submitBooking} disabled={bookingLoading}>
                {bookingLoading
                  ? paymentMethod === "crypto"
                    ? "Submitting..."
                    : "Requesting..."
                  : paymentMethod === "crypto"
                    ? "Submit Crypto Payment"
                    : "Pay with M-Pesa"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Market;
