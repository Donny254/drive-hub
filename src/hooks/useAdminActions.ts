import { useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import type {
  Booking,
  EventItem,
  EventRegistration,
  Inquiry,
  Listing,
  Order,
  OrderItem,
  Post,
  Product,
  Service,
  ServiceBooking,
  SiteSettings,
  User,
} from "@/components/admin/types";

type NotifyFn = (title: string, description?: string) => void;

type UseAdminActionsParams = {
  authHeaders: HeadersInit;
  fetchAll: () => Promise<void>;
  notifySuccess: NotifyFn;
  notifyError: NotifyFn;
  listings: Listing[];
  inquiries: Inquiry[];
  users: User[];
  bookings: Booking[];
  selectedListingIds: string[];
  selectedInquiryIds: string[];
  selectedUserIds: string[];
  editingListing: Listing | null;
  setEditingListing: (value: Listing | null | ((prev: Listing | null) => Listing | null)) => void;
  creatingListing: Listing | null;
  setCreatingListing: (value: Listing | null) => void;
  setCreateImageUrl: (value: string) => void;
  setEditImages: (value: Array<{ id: string; url: string }> | ((prev: Array<{ id: string; url: string }>) => Array<{ id: string; url: string }>)) => void;
  setEditImageUrl: (value: string) => void;
  setListingAudit: (value: []) => void;
  setSelectedListingIds: (value: string[]) => void;
  setConfirmBulkDeleteListingsOpen: (value: boolean) => void;
  editingOrder: Order | null;
  setEditingOrder: (value: Order | null) => void;
  setOrderDetailsOpen: (value: boolean) => void;
  setOrderDetails: (value: { order: Order; items: OrderItem[] } | null) => void;
  setOrderDetailsError: (value: string | null) => void;
  setOrderDetailsLoading: (value: boolean) => void;
  editingBooking: Booking | null;
  setEditingBooking: (value: Booking | null) => void;
  editingServiceBooking: ServiceBooking | null;
  setEditingServiceBooking: (value: ServiceBooking | null) => void;
  editingEventRegistration: EventRegistration | null;
  setEditingEventRegistration: (value: EventRegistration | null) => void;
  editingInquiry: Inquiry | null;
  setEditingInquiry: (value: Inquiry | null) => void;
  setSelectedInquiryIds: (value: string[]) => void;
  creatingService: Service | null;
  setCreatingService: (value: Service | null) => void;
  editingService: Service | null;
  setEditingService: (value: Service | null) => void;
  creatingEvent: EventItem | null;
  setCreatingEvent: (value: EventItem | null) => void;
  editingEvent: EventItem | null;
  setEditingEvent: (value: EventItem | null) => void;
  creatingProduct: Product | null;
  setCreatingProduct: (value: Product | null) => void;
  editingProduct: Product | null;
  setEditingProduct: (value: Product | null) => void;
  creatingPost: Post | null;
  setCreatingPost: (value: Post | null) => void;
  editingPost: Post | null;
  setEditingPost: (value: Post | null) => void;
  editingUser: User | null;
  setEditingUser: (value: User | null) => void;
  setSelectedUserIds: (value: string[]) => void;
  setConfirmBulkDeleteUsersOpen: (value: boolean) => void;
  settings: SiteSettings | null;
  setSettings: (value: SiteSettings) => void;
};

export const useAdminActions = ({
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
}: UseAdminActionsParams) => {
  const saveListing = useCallback(async () => {
    if (!editingListing) return;
    try {
      const resp = await apiFetch(`/api/listings/${editingListing.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(editingListing),
      });
      if (!resp.ok) throw new Error("Failed to update listing");
      setEditingListing(null);
      await fetchAll();
      notifySuccess("Listing updated", "The listing changes have been saved.");
    } catch (error) {
      console.error(error);
      notifyError("Update failed", "The listing could not be updated.");
    }
  }, [authHeaders, editingListing, fetchAll, notifyError, notifySuccess, setEditingListing]);

  const createListing = useCallback(async () => {
    if (!creatingListing) return;
    const payload = { ...creatingListing };
    delete (payload as Partial<Listing>).id;
    try {
      const resp = await apiFetch("/api/listings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Failed to create listing");
      setCreatingListing(null);
      setCreateImageUrl("");
      await fetchAll();
      notifySuccess("Listing created", "The new listing has been added.");
    } catch (error) {
      console.error(error);
      notifyError("Create failed", "The listing could not be created.");
    }
  }, [authHeaders, creatingListing, fetchAll, notifyError, notifySuccess, setCreateImageUrl, setCreatingListing]);

  const approveListing = useCallback(async (listing: Listing) => {
    try {
      const resp = await apiFetch(`/api/listings/${listing.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          status: "active",
          moderationNotes: listing.moderationNotes ?? "Approved by admin",
        }),
      });
      if (!resp.ok) throw new Error("Failed to approve listing");
      if (editingListing?.id === listing.id) {
        setEditingListing(null);
        setEditImages([]);
        setEditImageUrl("");
        setListingAudit([]);
      }
      await fetchAll();
      notifySuccess("Listing approved", `${listing.title} is now active.`);
    } catch (error) {
      console.error(error);
      notifyError("Approval failed", "The listing could not be approved.");
    }
  }, [authHeaders, editingListing, fetchAll, notifyError, notifySuccess, setEditImageUrl, setEditImages, setEditingListing, setListingAudit]);

  const saveOrder = useCallback(async () => {
    if (!editingOrder) return;
    const resp = await apiFetch(`/api/orders/${editingOrder.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: editingOrder.status, totalCents: editingOrder.totalCents }),
    });
    if (!resp.ok) throw new Error("Failed to update order");
    setEditingOrder(null);
    await fetchAll();
  }, [authHeaders, editingOrder, fetchAll, setEditingOrder]);

  const loadOrderDetails = useCallback(async (orderId: string) => {
    try {
      setOrderDetailsOpen(true);
      setOrderDetails(null);
      setOrderDetailsError(null);
      setOrderDetailsLoading(true);
      const resp = await apiFetch(`/api/orders/${orderId}`, { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load order details");
      const data = await resp.json();
      setOrderDetails({ order: data, items: data.items || [] });
    } catch (err) {
      console.error(err);
      setOrderDetailsError("Failed to load order details.");
    } finally {
      setOrderDetailsLoading(false);
    }
  }, [authHeaders, setOrderDetails, setOrderDetailsError, setOrderDetailsLoading, setOrderDetailsOpen]);

  const saveBooking = useCallback(async () => {
    if (!editingBooking) return;
    const resp = await apiFetch(`/api/bookings/${editingBooking.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: editingBooking.status }),
    });
    if (!resp.ok) throw new Error("Failed to update booking");
    setEditingBooking(null);
    await fetchAll();
  }, [authHeaders, editingBooking, fetchAll, setEditingBooking]);

  const saveServiceBooking = useCallback(async () => {
    if (!editingServiceBooking) return;
    const resp = await apiFetch(`/api/service-bookings/${editingServiceBooking.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        status: editingServiceBooking.status,
        scheduledDate: editingServiceBooking.scheduledDate,
        notes: editingServiceBooking.notes,
      }),
    });
    if (!resp.ok) throw new Error("Failed to update service booking");
    setEditingServiceBooking(null);
    await fetchAll();
  }, [authHeaders, editingServiceBooking, fetchAll, setEditingServiceBooking]);

  const saveEventRegistration = useCallback(async () => {
    if (!editingEventRegistration) return;
    const resp = await apiFetch(`/api/event-registrations/${editingEventRegistration.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        status: editingEventRegistration.status,
        tickets: editingEventRegistration.tickets,
        notes: editingEventRegistration.notes,
      }),
    });
    if (!resp.ok) throw new Error("Failed to update event registration");
    setEditingEventRegistration(null);
    await fetchAll();
  }, [authHeaders, editingEventRegistration, fetchAll, setEditingEventRegistration]);

  const saveInquiry = useCallback(async () => {
    if (!editingInquiry) return;
    try {
      const resp = await apiFetch(`/api/inquiries/${editingInquiry.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ status: editingInquiry.status }),
      });
      if (!resp.ok) throw new Error("Failed to update inquiry");
      setEditingInquiry(null);
      await fetchAll();
      notifySuccess("Inquiry updated", "The inquiry status has been saved.");
    } catch (error) {
      console.error(error);
      notifyError("Update failed", "The inquiry could not be updated.");
    }
  }, [authHeaders, editingInquiry, fetchAll, notifyError, notifySuccess, setEditingInquiry]);

  const bulkApproveListings = useCallback(async () => {
    const targets = listings.filter(
      (listing) =>
        selectedListingIds.includes(listing.id) &&
        (listing.status === "pending_approval" || listing.status === "rejected")
    );
    try {
      for (const listing of targets) {
        const resp = await apiFetch(`/api/listings/${listing.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            status: "active",
            moderationNotes: listing.moderationNotes ?? "Approved by admin",
          }),
        });
        if (!resp.ok) throw new Error("Failed to approve listing");
      }
      setSelectedListingIds([]);
      await fetchAll();
      notifySuccess("Listings approved", `${targets.length} listings were approved.`);
    } catch (error) {
      console.error(error);
      notifyError("Bulk approval failed", "One or more listings could not be approved.");
    }
  }, [authHeaders, fetchAll, listings, notifyError, notifySuccess, selectedListingIds, setSelectedListingIds]);

  const bulkDeleteListings = useCallback(async () => {
    try {
      for (const id of selectedListingIds) {
        const resp = await apiFetch(`/api/listings/${id}`, { method: "DELETE", headers: authHeaders });
        if (!resp.ok) throw new Error("Failed to delete listing");
      }
      const deletedCount = selectedListingIds.length;
      setSelectedListingIds([]);
      setConfirmBulkDeleteListingsOpen(false);
      await fetchAll();
      notifySuccess("Listings deleted", `${deletedCount} listings were removed.`);
    } catch (error) {
      console.error(error);
      notifyError("Bulk delete failed", "One or more listings could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess, selectedListingIds, setConfirmBulkDeleteListingsOpen, setSelectedListingIds]);

  const bulkHandleInquiries = useCallback(async () => {
    try {
      const targets = inquiries.filter((item) => selectedInquiryIds.includes(item.id));
      for (const inquiry of targets) {
        const resp = await apiFetch(`/api/inquiries/${inquiry.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ status: "handled" }),
        });
        if (!resp.ok) throw new Error("Failed to update inquiry");
      }
      setSelectedInquiryIds([]);
      await fetchAll();
      notifySuccess("Inquiries updated", `${targets.length} inquiries were marked handled.`);
    } catch (error) {
      console.error(error);
      notifyError("Bulk update failed", "One or more inquiries could not be updated.");
    }
  }, [authHeaders, fetchAll, inquiries, notifyError, notifySuccess, selectedInquiryIds, setSelectedInquiryIds]);

  const createService = useCallback(async () => {
    if (!creatingService) return;
    const resp = await apiFetch("/api/services", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingService),
    });
    if (!resp.ok) throw new Error("Failed to create service");
    setCreatingService(null);
    await fetchAll();
  }, [authHeaders, creatingService, fetchAll, setCreatingService]);

  const saveService = useCallback(async () => {
    if (!editingService) return;
    const resp = await apiFetch(`/api/services/${editingService.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingService),
    });
    if (!resp.ok) throw new Error("Failed to update service");
    setEditingService(null);
    await fetchAll();
  }, [authHeaders, editingService, fetchAll, setEditingService]);

  const deleteService = useCallback(async (id: string) => {
    const resp = await apiFetch(`/api/services/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete service");
    await fetchAll();
  }, [authHeaders, fetchAll]);

  const createEvent = useCallback(async () => {
    if (!creatingEvent) return;
    const resp = await apiFetch("/api/events", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingEvent),
    });
    if (!resp.ok) throw new Error("Failed to create event");
    setCreatingEvent(null);
    await fetchAll();
  }, [authHeaders, creatingEvent, fetchAll, setCreatingEvent]);

  const saveEvent = useCallback(async () => {
    if (!editingEvent) return;
    const resp = await apiFetch(`/api/events/${editingEvent.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingEvent),
    });
    if (!resp.ok) throw new Error("Failed to update event");
    setEditingEvent(null);
    await fetchAll();
  }, [authHeaders, editingEvent, fetchAll, setEditingEvent]);

  const deleteEvent = useCallback(async (id: string) => {
    const resp = await apiFetch(`/api/events/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete event");
    await fetchAll();
  }, [authHeaders, fetchAll]);

  const createProduct = useCallback(async () => {
    if (!creatingProduct) return;
    const resp = await apiFetch("/api/products", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingProduct),
    });
    if (!resp.ok) throw new Error("Failed to create product");
    setCreatingProduct(null);
    await fetchAll();
  }, [authHeaders, creatingProduct, fetchAll, setCreatingProduct]);

  const saveProduct = useCallback(async () => {
    if (!editingProduct) return;
    const resp = await apiFetch(`/api/products/${editingProduct.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingProduct),
    });
    if (!resp.ok) throw new Error("Failed to update product");
    setEditingProduct(null);
    await fetchAll();
  }, [authHeaders, editingProduct, fetchAll, setEditingProduct]);

  const deleteProduct = useCallback(async (id: string) => {
    const resp = await apiFetch(`/api/products/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete product");
    await fetchAll();
  }, [authHeaders, fetchAll]);

  const createPost = useCallback(async () => {
    if (!creatingPost) return;
    const resp = await apiFetch("/api/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingPost),
    });
    if (!resp.ok) throw new Error("Failed to create post");
    setCreatingPost(null);
    await fetchAll();
  }, [authHeaders, creatingPost, fetchAll, setCreatingPost]);

  const savePost = useCallback(async () => {
    if (!editingPost) return;
    const resp = await apiFetch(`/api/posts/${editingPost.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingPost),
    });
    if (!resp.ok) throw new Error("Failed to update post");
    setEditingPost(null);
    await fetchAll();
  }, [authHeaders, editingPost, fetchAll, setEditingPost]);

  const deletePost = useCallback(async (id: string) => {
    const resp = await apiFetch(`/api/posts/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete post");
    await fetchAll();
  }, [authHeaders, fetchAll]);

  const saveUser = useCallback(async () => {
    if (!editingUser) return;
    try {
      const resp = await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          name: editingUser.name,
          phone: editingUser.phone,
          role: editingUser.role,
          sellerVerificationStatus: editingUser.sellerVerificationStatus,
        }),
      });
      if (!resp.ok) throw new Error("Failed to update user");
      setEditingUser(null);
      await fetchAll();
      notifySuccess("User updated", "The user account changes have been saved.");
    } catch (error) {
      console.error(error);
      notifyError("Update failed", "The user could not be updated.");
    }
  }, [authHeaders, editingUser, fetchAll, notifyError, notifySuccess, setEditingUser]);

  const bulkVerifyUsers = useCallback(async () => {
    try {
      const targets = users.filter((item) => selectedUserIds.includes(item.id));
      for (const user of targets) {
        const resp = await apiFetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            name: user.name,
            phone: user.phone,
            role: user.role,
            sellerVerificationStatus: "verified",
          }),
        });
        if (!resp.ok) throw new Error("Failed to update user");
      }
      setSelectedUserIds([]);
      await fetchAll();
      notifySuccess("Users verified", `${targets.length} users were marked verified.`);
    } catch (error) {
      console.error(error);
      notifyError("Bulk verify failed", "One or more users could not be verified.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess, selectedUserIds, setSelectedUserIds, users]);

  const bulkDeleteUsers = useCallback(async () => {
    try {
      for (const id of selectedUserIds) {
        const resp = await apiFetch(`/api/users/${id}`, { method: "DELETE", headers: authHeaders });
        if (!resp.ok) throw new Error("Failed to delete user");
      }
      const deletedCount = selectedUserIds.length;
      setSelectedUserIds([]);
      setConfirmBulkDeleteUsersOpen(false);
      await fetchAll();
      notifySuccess("Users deleted", `${deletedCount} user accounts were removed.`);
    } catch (error) {
      console.error(error);
      notifyError("Bulk delete failed", "One or more users could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess, selectedUserIds, setConfirmBulkDeleteUsersOpen, setSelectedUserIds]);

  const saveSettings = useCallback(async () => {
    if (!settings) return;
    try {
      const resp = await apiFetch("/api/settings", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error("Failed to update settings");
      setSettings(await resp.json());
      notifySuccess("Settings saved", "Public site settings have been updated.");
    } catch (error) {
      console.error(error);
      notifyError("Save failed", "Settings could not be updated.");
    }
  }, [authHeaders, notifyError, notifySuccess, setSettings, settings]);

  const exportFinanceReport = useCallback((orders: Order[]) => {
    const rows = orders.map((order) => ({
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      totalCents: order.totalCents,
      totalKes: (order.totalCents / 100).toFixed(2),
      itemsCount: order.itemsCount ?? 0,
      createdAt: order.createdAt,
    }));
    const csv = toCsv(rows, ["orderId", "userId", "status", "totalCents", "totalKes", "itemsCount", "createdAt"]);
    downloadCsv("admin-finance-report.csv", csv);
  }, []);

  const exportFraudReport = useCallback((items: Listing[]) => {
    const rows = items.map((listing) => ({
      listingId: listing.id,
      title: listing.title,
      status: listing.status,
      riskScore: listing.riskScore ?? 0,
      riskFlags: listing.riskFlags?.join(" | ") ?? "",
      moderationNotes: listing.moderationNotes ?? "",
      approvedAt: listing.approvedAt ?? "",
      priceKes: (listing.priceCents / 100).toFixed(2),
    }));
    const csv = toCsv(rows, [
      "listingId",
      "title",
      "status",
      "riskScore",
      "riskFlags",
      "moderationNotes",
      "approvedAt",
      "priceKes",
    ]);
    downloadCsv("admin-fraud-report.csv", csv);
  }, []);

  const exportSellerPerformanceReport = useCallback(() => {
    const sellerRows = users.map((user) => {
      const userListings = listings.filter((listing) => listing.userId === user.id);
      const userListingIds = new Set(userListings.map((listing) => listing.id));
      const userInquiries = inquiries.filter((inquiry) => inquiry.listingId && userListingIds.has(inquiry.listingId));
      const userBookings = bookings.filter((booking) => booking.listingId && userListingIds.has(booking.listingId));
      const confirmedUserBookings = userBookings.filter((booking) => booking.status === "confirmed");

      return {
        userId: user.id,
        email: user.email,
        name: user.name ?? "",
        role: user.role,
        sellerVerificationStatus: user.sellerVerificationStatus,
        listingsCount: userListings.length,
        activeListings: userListings.filter((listing) => listing.status === "active").length,
        pendingListings: userListings.filter((listing) => listing.status === "pending_approval").length,
        totalInquiries: userInquiries.length,
        totalBookings: userBookings.length,
        confirmedBookings: confirmedUserBookings.length,
        createdAt: user.createdAt,
      };
    });

    const csv = toCsv(sellerRows, [
      "userId",
      "email",
      "name",
      "role",
      "sellerVerificationStatus",
      "listingsCount",
      "activeListings",
      "pendingListings",
      "totalInquiries",
      "totalBookings",
      "confirmedBookings",
      "createdAt",
    ]);
    downloadCsv("admin-seller-performance-report.csv", csv);
  }, [bookings, inquiries, listings, users]);

  const deleteListing = useCallback(async (id: string) => {
    try {
      const resp = await apiFetch(`/api/listings/${id}`, { method: "DELETE", headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to delete listing");
      await fetchAll();
      notifySuccess("Listing deleted", "The listing has been removed.");
    } catch (error) {
      console.error(error);
      notifyError("Delete failed", "The listing could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      const resp = await apiFetch(`/api/orders/${id}`, { method: "DELETE", headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to delete order");
      await fetchAll();
      notifySuccess("Order deleted", "The order has been removed.");
    } catch (error) {
      console.error(error);
      notifyError("Delete failed", "The order could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess]);

  const deleteBooking = useCallback(async (id: string) => {
    try {
      const resp = await apiFetch(`/api/bookings/${id}`, { method: "DELETE", headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to delete booking");
      await fetchAll();
      notifySuccess("Booking deleted", "The booking has been removed.");
    } catch (error) {
      console.error(error);
      notifyError("Delete failed", "The booking could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess]);

  const deleteUser = useCallback(async (id: string) => {
    try {
      const resp = await apiFetch(`/api/users/${id}`, { method: "DELETE", headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to delete user");
      await fetchAll();
      notifySuccess("User deleted", "The user account has been removed.");
    } catch (error) {
      console.error(error);
      notifyError("Delete failed", "The user could not be deleted.");
    }
  }, [authHeaders, fetchAll, notifyError, notifySuccess]);

  return {
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
  };
};
