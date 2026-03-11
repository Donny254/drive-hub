import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  AdminAnalytics,
  Booking,
  EventItem,
  EventRegistration,
  Inquiry,
  Listing,
  Order,
  Post,
  Product,
  Service,
  ServiceBooking,
  SiteSettings,
  User,
} from "@/components/admin/types";

type UseAdminDataParams = {
  token: string | null;
};

const defaultHeaders = {};

export const useAdminData = ({ token }: UseAdminDataParams) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceBookings, setServiceBookings] = useState<ServiceBooking[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistration[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return defaultHeaders;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        listingsRes,
        ordersRes,
        usersRes,
        bookingsRes,
        serviceBookingsRes,
        eventRegistrationsRes,
        inquiriesRes,
        servicesRes,
        eventsRes,
        productsRes,
        postsRes,
        settingsRes,
        analyticsRes,
      ] = await Promise.all([
        apiFetch("/api/listings?limit=200", { headers: authHeaders }),
        apiFetch("/api/orders", { headers: authHeaders }),
        apiFetch("/api/users", { headers: authHeaders }),
        apiFetch("/api/bookings", { headers: authHeaders }),
        apiFetch("/api/service-bookings", { headers: authHeaders }),
        apiFetch("/api/event-registrations", { headers: authHeaders }),
        apiFetch("/api/inquiries", { headers: authHeaders }),
        apiFetch("/api/services", { headers: authHeaders }),
        apiFetch("/api/events", { headers: authHeaders }),
        apiFetch("/api/products", { headers: authHeaders }),
        apiFetch("/api/posts", { headers: authHeaders }),
        apiFetch("/api/settings", { headers: authHeaders }),
        apiFetch("/api/listings/analytics/admin", { headers: authHeaders }),
      ]);

      if (!listingsRes.ok) throw new Error("Failed to load listings");
      if (!ordersRes.ok) throw new Error("Failed to load orders");
      if (!usersRes.ok) throw new Error("Failed to load users");
      if (!bookingsRes.ok) throw new Error("Failed to load bookings");
      if (!serviceBookingsRes.ok) throw new Error("Failed to load service bookings");
      if (!eventRegistrationsRes.ok) throw new Error("Failed to load event registrations");
      if (!inquiriesRes.ok) throw new Error("Failed to load inquiries");
      if (!servicesRes.ok) throw new Error("Failed to load services");
      if (!eventsRes.ok) throw new Error("Failed to load events");
      if (!productsRes.ok) throw new Error("Failed to load products");
      if (!postsRes.ok) throw new Error("Failed to load posts");
      if (!settingsRes.ok) throw new Error("Failed to load settings");
      if (!analyticsRes.ok) throw new Error("Failed to load analytics");

      setListings(await listingsRes.json());
      setOrders(await ordersRes.json());
      setUsers(await usersRes.json());
      setBookings(await bookingsRes.json());
      setServiceBookings(await serviceBookingsRes.json());
      setEventRegistrations(await eventRegistrationsRes.json());
      setInquiries(await inquiriesRes.json());
      setServices(await servicesRes.json());
      setEvents(await eventsRes.json());
      setProducts(await productsRes.json());
      setPosts(await postsRes.json());
      setSettings(await settingsRes.json());
      setAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
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
    setAnalytics,
    setBookings,
    setError,
    setEventRegistrations,
    setEvents,
    setInquiries,
    setListings,
    setLoading,
    setOrders,
    setPosts,
    setProducts,
    setServiceBookings,
    setServices,
    setSettings,
    setUsers,
    users,
  };
};
