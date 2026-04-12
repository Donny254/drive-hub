export type Listing = {
  id: string;
  userId?: string | null;
  title: string;
  priceCents: number;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "pending_approval" | "active" | "sold" | "inactive" | "rejected";
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  description: string | null;
  location: string | null;
  moderationNotes?: string | null;
  riskFlags?: string[];
  riskScore?: number;
  approvedAt?: string | null;
  approvedBy?: string | null;
  images?: Array<{ id: string; url: string }>;
};

export type ListingAuditEntry = {
  id: string;
  action: string;
  details: {
    changedFields?: string[];
    previousStatus?: string | null;
    nextStatus?: string | null;
    moderationNotes?: string | null;
    riskScore?: number;
    riskFlags?: string[];
    title?: string | null;
    imageId?: string;
    url?: string;
    position?: number;
    imageIds?: string[];
    extraImagesAdded?: number;
    createdByRole?: string;
  };
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
  } | null;
};

export type Inquiry = {
  id: string;
  userId: string | null;
  listingId: string | null;
  listingTitle?: string | null;
  inquiryType: "general" | "listing" | "quote" | "service";
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: "open" | "handled";
  handledAt: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "user" | "admin";
  sellerVerificationStatus: "unverified" | "pending" | "verified";
  sellerVerifiedAt: string | null;
  createdAt: string;
};

export type DeleteTarget =
  | { kind: "listing" | "order" | "booking" | "user"; id: string; label: string }
  | null;

export type Order = {
  id: string;
  userId: string;
  totalCents: number;
  paymentMethod?: string | null;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  paidAt?: string | null;
  cryptoReviewNotes?: string | null;
  cryptoProofImageUrl?: string | null;
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
  itemsCount?: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  priceCents: number;
  quantity: number;
  size: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export type Booking = {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string | null;
  listingImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "pending" | "confirmed" | "cancelled" | "rejected";
  paymentMethod?: string | null;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  amountCents?: number | null;
  cryptoReviewNotes?: string | null;
  cryptoProofImageUrl?: string | null;
  createdAt: string;
};

export type ServiceBooking = {
  id: string;
  userId: string;
  serviceId: string;
  serviceTitle: string | null;
  contactName: string | null;
  contactPhone: string | null;
  scheduledDate: string | null;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

export type EventRegistration = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string | null;
  paymentMethod?: string | null;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  paidAt?: string | null;
  cryptoReviewNotes?: string | null;
  cryptoProofImageUrl?: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

export type Service = {
  id: string;
  title: string;
  description: string | null;
  features: string[];
  priceCents: number | null;
  imageUrl: string | null;
  active: boolean;
};

export type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  status: "upcoming" | "past" | "cancelled";
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string | null;
  imageUrl: string | null;
  sizes: string[];
  stock: number;
  active: boolean;
};

export type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
};

export type SiteSettings = {
  companyName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialYoutube: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwift: string | null;
  bankInstructions: string | null;
  sellerCommissionRate: number;
  cryptoCurrency: string | null;
  cryptoNetwork: string | null;
  cryptoWalletAddress: string | null;
  cryptoInstructions: string | null;
};

export type AdminAnalytics = {
  summary: {
    totalListings: number;
    activeListings: number;
    pendingListings: number;
    rejectedListings: number;
    soldListings: number;
    highRiskListings: number;
    averageRiskScore: number;
    totalViews: number;
    totalInquiries: number;
    totalBookings: number;
    confirmedBookings: number;
    verifiedSellers: number;
    viewToInquiryRate: number;
    inquiryToBookingRate: number;
    inquiryToConfirmedRate: number;
  };
  topRiskListings: Array<{
    id: string;
    title: string;
    status: Listing["status"];
    riskScore: number;
    moderationNotes: string | null;
    sellerName: string;
  }>;
  topViewedListings: Array<{
    id: string;
    title: string;
    status: Listing["status"];
    viewsCount: number;
    inquiriesCount: number;
  }>;
};

export type SystemHealth = {
  ok: boolean;
  db: "ok" | "down";
  mail?: "configured" | "not_configured";
  time: string;
};

export type CryptoTransaction = {
  id: string;
  relationType: "order" | "booking" | "event_registration" | "unknown";
  orderId?: string | null;
  bookingId?: string | null;
  eventRegistrationId?: string | null;
  reference: string;
  label: string | null;
  asset: string;
  network: string | null;
  walletAddress: string | null;
  payerWallet: string | null;
  transactionHash: string;
  proofImageUrl: string | null;
  amountCents: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  reviewNotes: string | null;
  createdAt: string;
};

export type Payout = {
  id: string;
  bookingId: string;
  sellerId: string;
  listingId: string | null;
  listingTitle: string | null;
  buyerName: string | null;
  amountCents: number;
  feeCents: number;
  payoutAmountCents: number;
  payoutStatus: "pending" | "paid" | "failed" | "cancelled";
  payoutAt: string | null;
  notes: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
};
