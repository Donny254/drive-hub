import { useEffect, useMemo, useState } from "react";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import AdminBulkActionBar from "@/components/admin/AdminBulkActionBar";
import AdminBookingsTab from "@/components/admin/AdminBookingsTab";
import AdminDeleteConfirmDialog from "@/components/admin/AdminDeleteConfirmDialog";
import AdminEventRegistrationsTab from "@/components/admin/AdminEventRegistrationsTab";
import AdminCryptoPaymentsTab from "@/components/admin/AdminCryptoPaymentsTab";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminInquiriesTab from "@/components/admin/AdminInquiriesTab";
import AdminOrdersTab from "@/components/admin/AdminOrdersTab";
import AdminListingsTab from "@/components/admin/AdminListingsTab";
import AdminPayoutsTab from "@/components/admin/AdminPayoutsTab";
import AdminServiceBookingsTab from "@/components/admin/AdminServiceBookingsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminTablePagination from "@/components/admin/AdminTablePagination";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import type {
  AdminAnalytics,
  Booking,
  CryptoTransaction,
  DeleteTarget,
  EventItem,
  EventRegistration,
  Inquiry,
  Listing,
  ListingAuditEntry,
  Order,
  OrderItem,
  Post,
  Product,
  Payout,
  Service,
  ServiceBooking,
  SiteSettings,
  SystemHealth,
  User,
} from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, uploadImage, resolveImageUrl } from "@/lib/api";
import { useAdminActions } from "@/hooks/useAdminActions";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminListingEditor } from "@/hooks/useAdminListingEditor";
import { useAdminViewState } from "@/hooks/useAdminViewState";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Car, CalendarCheck, Coins, Banknote, Wrench,
  Ticket, MessageSquare, Settings2, CalendarDays, Package, FileText,
  ShoppingBag, Users, Settings, Megaphone, Clock, AlertTriangle,
} from "lucide-react";

const formatMoney = (cents?: number | null) => {
  if (cents === null || cents === undefined) return "--";
  return `KES ${(cents / 100).toLocaleString()}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const ADMIN_TABS = [
  "overview",
  "listings",
  "orders",
  "bookings",
  "crypto-payments",
  "payouts",
  "service-bookings",
  "event-registrations",
  "inquiries",
  "users",
  "settings",
  "services",
  "events",
  "products",
  "blog",
] as const;

const parsePageParam = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

const statusVariant = (status?: string | null) => {
  switch (status) {
    case "paid":
    case "confirmed":
    case "active":
    case "upcoming":
      return "default";
    case "pending":
    case "past":
    case "inactive":
    case "sold":
      return "secondary";
    case "cancelled":
    case "rejected":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const { toast } = useToast();
  const {
    analytics,
    authHeaders,
    bookings,
    cryptoTransactions,
    error,
    eventRegistrations,
    events,
    fetchAll,
    fetchSystemHealth,
    inquiries,
    listings,
    loading,
    orders,
    payouts,
    posts,
    products,
    serviceBookings,
    services,
    settings,
    systemHealth,
    setBookings,
    setEventRegistrations,
    setEvents,
    setInquiries,
    setListings,
    setOrders,
    setPosts,
    setProducts,
    setServiceBookings,
    setServices,
    setSettings,
    setUsers,
    users,
  } = useAdminData({ token });
  const [refreshingSystemHealth, setRefreshingSystemHealth] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<(typeof ADMIN_TABS)[number]>(
    initialTab && ADMIN_TABS.includes(initialTab as (typeof ADMIN_TABS)[number])
      ? (initialTab as (typeof ADMIN_TABS)[number])
      : "overview"
  );

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [creatingService, setCreatingService] = useState<Service | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<EventItem | null>(null);
  const [creatingProduct, setCreatingProduct] = useState<Product | null>(null);
  const [creatingPost, setCreatingPost] = useState<Post | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingPayout, setEditingPayout] = useState<Payout | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingServiceBooking, setEditingServiceBooking] = useState<ServiceBooking | null>(null);
  const [editingEventRegistration, setEditingEventRegistration] = useState<EventRegistration | null>(null);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [listingStatusFilter, setListingStatusFilter] = useState<Listing["status"] | "all">(
    (searchParams.get("listingStatus") as Listing["status"] | "all") || "all"
  );
  const [userSearch, setUserSearch] = useState(searchParams.get("userSearch") || "");
  const [userVerificationFilter, setUserVerificationFilter] = useState<User["sellerVerificationStatus"] | "all">(
    (searchParams.get("userVerification") as User["sellerVerificationStatus"] | "all") || "all"
  );
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<Inquiry["status"] | "all">(
    (searchParams.get("inquiryStatus") as Inquiry["status"] | "all") || "all"
  );
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [confirmBulkDeleteListingsOpen, setConfirmBulkDeleteListingsOpen] = useState(false);
  const [confirmBulkDeleteUsersOpen, setConfirmBulkDeleteUsersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [listingsPage, setListingsPage] = useState(parsePageParam(searchParams.get("listingsPage")));
  const [inquiriesPage, setInquiriesPage] = useState(parsePageParam(searchParams.get("inquiriesPage")));
  const [usersPage, setUsersPage] = useState(parsePageParam(searchParams.get("usersPage")));

  const {
    addEditImageUrl,
    createImageUrl,
    creatingListing,
    editImageUrl,
    editImages,
    editingListing,
    handleUpload,
    listingAudit,
    listingAuditLoading,
    loadListingAudit,
    openEdit,
    removeEditImage,
    reorderEditImages,
    setCreateImageUrl,
    setCreatingListing,
    setEditImageUrl,
    setEditImages,
    setEditingListing,
    setListingAudit,
    uploading,
  } = useAdminListingEditor({ token, authHeaders });

  const emptyService: Service = {
    id: "",
    title: "",
    description: null,
    features: [],
    priceCents: null,
    imageUrl: null,
    active: true,
  };

  const emptyEvent: EventItem = {
    id: "",
    title: "",
    description: null,
    location: null,
    startDate: null,
    endDate: null,
    imageUrl: null,
    status: "upcoming",
  };

  const emptyProduct: Product = {
    id: "",
    name: "",
    description: null,
    priceCents: 0,
    category: null,
    imageUrl: null,
    sizes: [],
    stock: 0,
    active: true,
  };

  const emptyPost: Post = {
    id: "",
    title: "",
    excerpt: null,
    content: null,
    imageUrl: null,
    status: "draft",
    publishedAt: null,
  };

  const emptyListing: Listing = {
    id: "",
    title: "",
    priceCents: 0,
    listingType: "buy",
    featured: false,
    status: "active",
    year: new Date().getFullYear(),
    mileage: null,
    fuel: null,
    powerHp: null,
    imageUrl: null,
    description: null,
    location: null,
    moderationNotes: null,
    riskFlags: [],
    riskScore: 0,
    approvedAt: null,
    approvedBy: null,
  };

  const notifySuccess = (title: string, description?: string) => {
    toast({ title, description });
  };

  const notifyError = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "destructive",
    });
  };

  const refreshSystemHealth = async () => {
    try {
      setRefreshingSystemHealth(true);
      await fetchSystemHealth();
      notifySuccess("System status refreshed.");
    } catch (error) {
      notifyError("Unable to refresh system status.", error instanceof Error ? error.message : undefined);
    } finally {
      setRefreshingSystemHealth(false);
    }
  };

  const openCryptoReview = (transaction: CryptoTransaction) => {
    if (transaction.relationType === "order" && transaction.orderId) {
      const order = orders.find((item) => item.id === transaction.orderId);
      if (order) {
        setEditingOrder({ ...order });
        setActiveTab("orders");
      }
      return;
    }

    if (transaction.relationType === "booking" && transaction.bookingId) {
      const booking = bookings.find((item) => item.id === transaction.bookingId);
      if (booking) {
        setEditingBooking({ ...booking });
        setActiveTab("bookings");
      }
      return;
    }

    if (transaction.relationType === "event_registration" && transaction.eventRegistrationId) {
      const registration = eventRegistrations.find((item) => item.id === transaction.eventRegistrationId);
      if (registration) {
        setEditingEventRegistration({ ...registration });
        setActiveTab("event-registrations");
      }
    }
  };

  const {
    approveListing,
    bulkApproveListings,
    bulkDeleteListings,
    bulkDeleteUsers,
    bulkHandleInquiries,
    bulkVerifyUsers,
    createEvent,
    createListing,
    createPost,
    createProduct,
    createService,
    deleteBooking,
    deleteEvent,
    deleteListing,
    deleteOrder,
    deletePost,
    deleteProduct,
    deleteService,
    deleteUser,
    exportFinanceReport,
    exportFraudReport,
    exportSellerPerformanceReport,
    loadOrderDetails,
    saveBooking,
    savePayout,
    saveEvent,
    saveEventRegistration,
    saveInquiry,
    saveListing,
    saveOrder,
    savePost,
    saveProduct,
    saveService,
    saveServiceBooking,
    saveSettings,
    saveUser,
  } = useAdminActions({
    authHeaders,
    fetchAll,
    notifySuccess,
    notifyError,
    listings,
    inquiries,
    users,
    bookings,
    editingPayout,
    setEditingPayout,
    selectedListingIds,
    selectedInquiryIds,
    selectedUserIds,
    editingListing,
    setEditingListing,
    creatingListing,
    setCreatingListing,
    setCreateImageUrl,
    setEditImages,
    setEditImageUrl,
    setListingAudit,
    setSelectedListingIds,
    setConfirmBulkDeleteListingsOpen,
    editingOrder,
    setEditingOrder,
    setOrderDetailsOpen,
    setOrderDetails,
    setOrderDetailsError,
    setOrderDetailsLoading,
    editingBooking,
    setEditingBooking,
    editingServiceBooking,
    setEditingServiceBooking,
    editingEventRegistration,
    setEditingEventRegistration,
    editingInquiry,
    setEditingInquiry,
    setSelectedInquiryIds,
    creatingService,
    setCreatingService,
    editingService,
    setEditingService,
    creatingEvent,
    setCreatingEvent,
    editingEvent,
    setEditingEvent,
    creatingProduct,
    setCreatingProduct,
    editingProduct,
    setEditingProduct,
    creatingPost,
    setCreatingPost,
    editingPost,
    setEditingPost,
    editingUser,
    setEditingUser,
    setSelectedUserIds,
    setConfirmBulkDeleteUsersOpen,
    settings,
    setSettings,
  });

  const {
    filteredInquiries,
    filteredListings,
    filteredUsers,
    flaggedMediaListings,
    inquiriesPageCount,
    listingsNeedingReview,
    listingsPageCount,
    paginatedInquiries,
    paginatedListings,
    paginatedUsers,
    usersPageCount,
  } = useAdminViewState({
    inquiries,
    inquiryStatusFilter,
    inquiriesPage,
    listings,
    listingStatusFilter,
    listingsPage,
    setInquiriesPage,
    setListingsPage,
    setUsersPage,
    userSearch,
    userVerificationFilter,
    users,
    usersPage,
  });

  const toggleSelection = (id: string, selected: string[], setSelected: (ids: string[]) => void) => {
    setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const confirmSingleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    switch (target.kind) {
      case "listing":
        await deleteListing(target.id);
        break;
      case "order":
        await deleteOrder(target.id);
        break;
      case "booking":
        await deleteBooking(target.id);
        break;
      case "user":
        await deleteUser(target.id);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const next = new URLSearchParams();
    if (activeTab !== "overview") next.set("tab", activeTab);
    if (listingStatusFilter !== "all") next.set("listingStatus", listingStatusFilter);
    if (userSearch.trim()) next.set("userSearch", userSearch.trim());
    if (userVerificationFilter !== "all") next.set("userVerification", userVerificationFilter);
    if (inquiryStatusFilter !== "all") next.set("inquiryStatus", inquiryStatusFilter);
    if (listingsPage > 1) next.set("listingsPage", String(listingsPage));
    if (inquiriesPage > 1) next.set("inquiriesPage", String(inquiriesPage));
    if (usersPage > 1) next.set("usersPage", String(usersPage));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    activeTab,
    inquiryStatusFilter,
    inquiriesPage,
    listingStatusFilter,
    listingsPage,
    searchParams,
    setSearchParams,
    userSearch,
    userVerificationFilter,
    usersPage,
  ]);

  const NAV_GROUPS = [
    {
      label: "Dashboard",
      items: [
        { value: "overview", label: "Overview", icon: LayoutDashboard },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { value: "listings",  label: "Listings",  icon: Car },
        { value: "inquiries", label: "Inquiries", icon: MessageSquare },
      ],
    },
    {
      label: "Transactions",
      items: [
        { value: "orders",               label: "Orders",          icon: ShoppingBag },
        { value: "bookings",             label: "Bookings",        icon: CalendarCheck },
        { value: "crypto-payments",      label: "Crypto Payments", icon: Coins },
        { value: "payouts",              label: "Payouts",         icon: Banknote },
        { value: "service-bookings",     label: "Svc Bookings",    icon: Wrench },
        { value: "event-registrations",  label: "Event Regs",      icon: Ticket },
      ],
    },
    {
      label: "Content",
      items: [
        { value: "services", label: "Services", icon: Settings2 },
        { value: "events",   label: "Events",   icon: CalendarDays },
        { value: "products", label: "Products", icon: Package },
        { value: "posts",    label: "Blog",     icon: FileText },
      ],
    },
    {
      label: "Admin",
      items: [
        { value: "users",    label: "Users",    icon: Users },
        { value: "settings", label: "Settings", icon: Settings },
      ],
    },
  ] as const;

  const QUICK_LINKS = [
    { to: "/admin/services", icon: Wrench,       label: "Services" },
    { to: "/admin/events",   icon: CalendarDays, label: "Events" },
    { to: "/admin/products", icon: Package,      label: "Products" },
    { to: "/admin/adverts",  icon: Megaphone,    label: "Adverts" },
    { to: "/admin/posts",    icon: FileText,     label: "Blog" },
  ] as const;

  const currentSection = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.value === activeTab);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70">Control Center</p>
        <h2 className="mt-0.5 font-display text-base">Admin</h2>
        {analytics && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-primary/10 p-2 text-center">
              <p className="text-xs font-semibold tabular-nums text-primary">{analytics.summary.activeListings}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">Live</p>
            </div>
            <div className="rounded-lg bg-amber-400/10 p-2 text-center">
              <p className="text-xs font-semibold tabular-nums text-amber-400">{analytics.summary.pendingListings}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">Queue</p>
            </div>
            <div className="rounded-lg bg-red-400/10 p-2 text-center">
              <p className="text-xs font-semibold tabular-nums text-red-400">{analytics.summary.highRiskListings}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">Risk</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setActiveTab(value as (typeof ADMIN_TABS)[number]); setSidebarOpen(false); }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                    activeTab === value
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Quick links separator */}
        <div>
          <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">Quick Links</p>
          <div className="space-y-0.5">
            {QUICK_LINKS.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-150 hover:bg-border/40 hover:text-foreground"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="flex pt-20">
        {/* Desktop sidebar */}
        <aside className="fixed left-0 top-20 hidden h-[calc(100vh-5rem)] w-56 flex-col overflow-hidden border-r border-border bg-card lg:flex">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside className="absolute left-0 top-0 h-full w-56 border-r border-border bg-card pt-20" onClick={(e) => e.stopPropagation()}>
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-h-[calc(100vh-5rem)] flex-1 lg:ml-56">
          {/* Page header */}
          <div className="sticky top-20 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6">
              <button
                type="button"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-border/40 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <LayoutDashboard className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Admin</span>
                <span>/</span>
                <span className="text-foreground font-medium">{currentSection?.label ?? "Dashboard"}</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-5 md:px-6">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                Loading admin data…
              </div>
            )}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof ADMIN_TABS)[number])}>
                {/* No TabsList — sidebar handles navigation */}

                <AdminOverviewTab
                  analytics={analytics}
                  flaggedMediaListings={flaggedMediaListings}
                  systemHealth={systemHealth}
                  cryptoTransactions={cryptoTransactions}
                  refreshingSystemHealth={refreshingSystemHealth}
                  exportFinanceReport={() => exportFinanceReport(orders)}
                  exportFraudReport={() => exportFraudReport(listings)}
                  exportSellerPerformanceReport={exportSellerPerformanceReport}
                  refreshSystemHealth={refreshSystemHealth}
                  openEdit={openEdit}
                  approveListing={approveListing}
                  openCryptoReview={openCryptoReview}
                  statusVariant={statusVariant}
                />

                <AdminListingsTab
                  listings={listings}
                  flaggedMediaListings={flaggedMediaListings}
                  listingsNeedingReview={listingsNeedingReview}
                  creatingListing={creatingListing}
                  setCreatingListing={setCreatingListing}
                  editingListing={editingListing}
                  setEditingListing={setEditingListing}
                  createImageUrl={createImageUrl}
                  setCreateImageUrl={setCreateImageUrl}
                  editImageUrl={editImageUrl}
                  setEditImageUrl={setEditImageUrl}
                  editImages={editImages}
                  setEditImages={setEditImages}
                  listingAudit={listingAudit}
                  listingAuditLoading={listingAuditLoading}
                  selectedListingIds={selectedListingIds}
                  setSelectedListingIds={setSelectedListingIds}
                  confirmBulkDeleteListingsOpen={confirmBulkDeleteListingsOpen}
                  setConfirmBulkDeleteListingsOpen={setConfirmBulkDeleteListingsOpen}
                  listingStatusFilter={listingStatusFilter}
                  setListingStatusFilter={setListingStatusFilter}
                  filteredListings={filteredListings}
                  paginatedListings={paginatedListings}
                  listingsPage={listingsPage}
                  listingsPageCount={listingsPageCount}
                  setListingsPage={setListingsPage}
                  uploading={uploading}
                  emptyListing={emptyListing}
                  openEdit={openEdit}
                  approveListing={approveListing}
                  bulkApproveListings={bulkApproveListings}
                  bulkDeleteListings={bulkDeleteListings}
                  createListing={createListing}
                  saveListing={saveListing}
                  handleUpload={handleUpload}
                  loadListingAudit={loadListingAudit}
                  removeEditImage={removeEditImage}
                  reorderEditImages={reorderEditImages}
                  toggleSelection={toggleSelection}
                  formatMoney={formatMoney}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
                  statusVariant={statusVariant}
                  setDeleteTarget={setDeleteTarget}
                  addEditImageUrl={addEditImageUrl}
                />

                  <AdminOrdersTab
                    orders={orders}
                    editingOrder={editingOrder}
                    setEditingOrder={setEditingOrder}
                    saveOrder={saveOrder}
                    loadOrderDetails={loadOrderDetails}
                    orderDetailsOpen={orderDetailsOpen}
                    setOrderDetailsOpen={setOrderDetailsOpen}
                    orderDetails={orderDetails}
                    orderDetailsLoading={orderDetailsLoading}
                    orderDetailsError={orderDetailsError}
                    setDeleteTarget={setDeleteTarget}
                    statusVariant={statusVariant}
                    formatMoney={formatMoney}
                    token={token}
                  />

                  <AdminBookingsTab
                    bookings={bookings}
                    editingBooking={editingBooking}
                    setEditingBooking={setEditingBooking}
                    saveBooking={saveBooking}
                    setDeleteTarget={setDeleteTarget}
                    statusVariant={statusVariant}
                    formatMoney={formatMoney}
                    token={token}
                  />

                <AdminCryptoPaymentsTab
                  cryptoTransactions={cryptoTransactions}
                  openCryptoReview={openCryptoReview}
                  formatMoney={formatMoney}
                  statusVariant={statusVariant}
                />

                <AdminPayoutsTab
                  payouts={payouts}
                  editingPayout={editingPayout}
                  setEditingPayout={setEditingPayout}
                  savePayout={savePayout}
                  statusVariant={statusVariant}
                  formatMoney={formatMoney}
                />

                <AdminServiceBookingsTab
                  serviceBookings={serviceBookings}
                  editingServiceBooking={editingServiceBooking}
                  setEditingServiceBooking={setEditingServiceBooking}
                  saveServiceBooking={saveServiceBooking}
                  statusVariant={statusVariant}
                />

                  <AdminEventRegistrationsTab
                    eventRegistrations={eventRegistrations}
                    editingEventRegistration={editingEventRegistration}
                    setEditingEventRegistration={setEditingEventRegistration}
                    saveEventRegistration={saveEventRegistration}
                    statusVariant={statusVariant}
                    token={token}
                  />

                <TabsContent value="inquiries" className="mt-6">
                  <AdminInquiriesTab
                    inquiries={inquiries}
                    filteredInquiries={filteredInquiries}
                    paginatedInquiries={paginatedInquiries}
                    inquiryStatusFilter={inquiryStatusFilter}
                    setInquiryStatusFilter={setInquiryStatusFilter}
                    selectedInquiryIds={selectedInquiryIds}
                    setSelectedInquiryIds={setSelectedInquiryIds}
                    editingInquiry={editingInquiry}
                    setEditingInquiry={setEditingInquiry}
                    bulkHandleInquiries={bulkHandleInquiries}
                    saveInquiry={saveInquiry}
                    inquiriesPage={inquiriesPage}
                    inquiriesPageCount={inquiriesPageCount}
                    setInquiriesPage={setInquiriesPage}
                    toggleSelection={toggleSelection}
                    statusVariant={statusVariant}
                    formatDate={formatDate}
                  />
                </TabsContent>

                <TabsContent value="users" className="mt-6">
                  <AdminUsersTab
                    users={users}
                    filteredUsers={filteredUsers}
                    paginatedUsers={paginatedUsers}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    userVerificationFilter={userVerificationFilter}
                    setUserVerificationFilter={setUserVerificationFilter}
                    selectedUserIds={selectedUserIds}
                    setSelectedUserIds={setSelectedUserIds}
                    editingUser={editingUser}
                    setEditingUser={setEditingUser}
                    bulkVerifyUsers={bulkVerifyUsers}
                    setConfirmBulkDeleteUsersOpen={setConfirmBulkDeleteUsersOpen}
                    saveUser={saveUser}
                    usersPage={usersPage}
                    usersPageCount={usersPageCount}
                    setUsersPage={setUsersPage}
                    setDeleteTarget={setDeleteTarget}
                    toggleSelection={toggleSelection}
                  />
                  <AlertDialog
                    open={confirmBulkDeleteUsersOpen}
                    onOpenChange={setConfirmBulkDeleteUsersOpen}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete selected users?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove {selectedUserIds.length} selected user accounts. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Users</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={bulkDeleteUsers}
                        >
                          Delete Users
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                <AdminSettingsTab
                  settings={settings}
                  setSettings={setSettings}
                  saveSettings={saveSettings}
                />
                </Tabs>
                <AdminDeleteConfirmDialog
                  deleteTarget={deleteTarget}
                  setDeleteTarget={setDeleteTarget}
                  confirmSingleDelete={confirmSingleDelete}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminWithBoundary = () => (
  <ErrorBoundary>
    <Admin />
  </ErrorBoundary>
);

export default AdminWithBoundary;
