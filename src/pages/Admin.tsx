import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdminBulkActionBar from "@/components/admin/AdminBulkActionBar";
import AdminBookingsTab from "@/components/admin/AdminBookingsTab";
import AdminDeleteConfirmDialog from "@/components/admin/AdminDeleteConfirmDialog";
import AdminEventRegistrationsTab from "@/components/admin/AdminEventRegistrationsTab";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminInquiriesTab from "@/components/admin/AdminInquiriesTab";
import AdminOrdersTab from "@/components/admin/AdminOrdersTab";
import AdminListingsTab from "@/components/admin/AdminListingsTab";
import AdminServiceBookingsTab from "@/components/admin/AdminServiceBookingsTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminTablePagination from "@/components/admin/AdminTablePagination";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import type {
  AdminAnalytics,
  Booking,
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
  Service,
  ServiceBooking,
  SiteSettings,
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
    error,
    eventRegistrations,
    events,
    fetchAll,
    inquiries,
    listings,
    loading,
    orders,
    posts,
    products,
    serviceBookings,
    services,
    settings,
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
            <section className="overflow-hidden rounded-3xl border border-border bg-card">
              <div className="bg-[radial-gradient(circle_at_top_left,rgba(0,229,184,0.18),transparent_42%),linear-gradient(135deg,rgba(255,167,38,0.1),transparent_48%)] px-6 py-8 md:px-8">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Control Center</p>
                <h1 className="mt-3 font-display text-4xl tracking-wider md:text-5xl">Admin Dashboard</h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
                  Run moderation, seller operations, orders, and marketplace health from one surface.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Live</p>
                    <p className="mt-2 text-3xl font-semibold">{analytics?.summary.activeListings ?? "--"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Active listings</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Queue</p>
                    <p className="mt-2 text-3xl font-semibold">{analytics?.summary.pendingListings ?? "--"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Pending approvals</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Risk</p>
                    <p className="mt-2 text-3xl font-semibold">{analytics?.summary.highRiskListings ?? "--"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">High-risk listings</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Link to="/admin/services" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/60 hover:bg-card/80">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Operations</p>
                <h3 className="mt-3 font-display text-xl tracking-wider">Services</h3>
                <p className="mt-2 text-sm text-muted-foreground">Manage service offerings</p>
              </Link>
              <Link to="/admin/events" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/60 hover:bg-card/80">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Community</p>
                <h3 className="mt-3 font-display text-xl tracking-wider">Events</h3>
                <p className="mt-2 text-sm text-muted-foreground">Manage event listings</p>
              </Link>
              <Link to="/admin/products" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/60 hover:bg-card/80">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Commerce</p>
                <h3 className="mt-3 font-display text-xl tracking-wider">Store Products</h3>
                <p className="mt-2 text-sm text-muted-foreground">Manage merch products</p>
              </Link>
              <Link to="/admin/posts" className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/60 hover:bg-card/80">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Content</p>
                <h3 className="mt-3 font-display text-xl tracking-wider">Blog Posts</h3>
                <p className="mt-2 text-sm text-muted-foreground">Manage blog content</p>
              </Link>
            </section>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading admin data...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as (typeof ADMIN_TABS)[number])}>
                <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-border bg-card p-2">
                  <TabsTrigger className="rounded-xl px-4 py-2" value="overview">Overview</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="listings">Listings</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="service-bookings">Service Bookings</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="event-registrations">Event Registrations</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="inquiries">Inquiries</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="services">Services</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="events">Events</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="products">Products</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="posts">Blog</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="orders">Orders</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="users">Users</TabsTrigger>
                  <TabsTrigger className="rounded-xl px-4 py-2" value="settings">Settings</TabsTrigger>
                </TabsList>

                <AdminOverviewTab
                  analytics={analytics}
                  flaggedMediaListings={flaggedMediaListings}
                  exportFinanceReport={() => exportFinanceReport(orders)}
                  exportFraudReport={() => exportFraudReport(listings)}
                  exportSellerPerformanceReport={exportSellerPerformanceReport}
                  openEdit={openEdit}
                  approveListing={approveListing}
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
                />

                <AdminBookingsTab
                  bookings={bookings}
                  editingBooking={editingBooking}
                  setEditingBooking={setEditingBooking}
                  saveBooking={saveBooking}
                  setDeleteTarget={setDeleteTarget}
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
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
