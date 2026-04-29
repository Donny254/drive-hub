import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  AdminAnalytics,
  Booking,
  CryptoTransaction,
  EventItem,
  EventRegistration,
  Inquiry,
  Listing,
  Order,
  Post,
  Product,
  Payout,
  Service,
  ServiceBooking,
  SiteSettings,
  SystemHealth,
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
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [cryptoTransactions, setCryptoTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return defaultHeaders;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchSystemHealth = useCallback(async () => {
    const healthRes = await apiFetch("/api/health");
    if (!healthRes.ok) {
      throw new Error("Failed to load system health");
    }
    const health = (await healthRes.json()) as SystemHealth;
    setSystemHealth(health);
    return health;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Missing admin auth token.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const requests = [
        { key: "listings", label: "listings", path: "/api/listings?limit=200" },
        { key: "orders", label: "orders", path: "/api/orders" },
        { key: "users", label: "users", path: "/api/users" },
        { key: "bookings", label: "bookings", path: "/api/bookings" },
        { key: "serviceBookings", label: "service bookings", path: "/api/service-bookings" },
        { key: "eventRegistrations", label: "event registrations", path: "/api/event-registrations" },
        { key: "inquiries", label: "inquiries", path: "/api/inquiries" },
        { key: "services", label: "services", path: "/api/services" },
        { key: "events", label: "events", path: "/api/events" },
        { key: "products", label: "products", path: "/api/products" },
        { key: "posts", label: "posts", path: "/api/posts" },
        { key: "settings", label: "settings", path: "/api/settings" },
        { key: "analytics", label: "analytics", path: "/api/listings/analytics/admin" },
        {
          key: "cryptoTransactions",
          label: "crypto transactions",
          path: "/api/payments/crypto-transactions?status=all",
        },
        { key: "payouts", label: "payouts", path: "/api/payouts" },
        { key: "systemHealth", label: "system health", path: "/api/health" },
      ] as const;

      const results = await Promise.allSettled(
        requests.map(async ({ key, label, path }) => {
          const response = await apiFetch(path, { headers: authHeaders });
          if (!response.ok) {
            throw new Error(`Failed to load ${label}`);
          }

          return { key, data: await response.json() };
        })
      );

      const failedLabels: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          failedLabels.push(requests[index].label);
          return;
        }

        switch (result.value.key) {
          case "listings":
            setListings(result.value.data as Listing[]);
            break;
          case "orders":
            setOrders(result.value.data as Order[]);
            break;
          case "users":
            setUsers(result.value.data as User[]);
            break;
          case "bookings":
            setBookings(result.value.data as Booking[]);
            break;
          case "serviceBookings":
            setServiceBookings(result.value.data as ServiceBooking[]);
            break;
          case "eventRegistrations":
            setEventRegistrations(result.value.data as EventRegistration[]);
            break;
          case "inquiries":
            setInquiries(result.value.data as Inquiry[]);
            break;
          case "services":
            setServices(result.value.data as Service[]);
            break;
          case "events":
            setEvents(result.value.data as EventItem[]);
            break;
          case "products":
            setProducts(result.value.data as Product[]);
            break;
          case "posts":
            setPosts(result.value.data as Post[]);
            break;
          case "settings":
            setSettings(result.value.data as SiteSettings);
            break;
          case "analytics":
            setAnalytics(result.value.data as AdminAnalytics);
            break;
          case "cryptoTransactions":
            setCryptoTransactions(result.value.data as CryptoTransaction[]);
            break;
          case "payouts":
            setPayouts(result.value.data as Payout[]);
            break;
          case "systemHealth":
            setSystemHealth(result.value.data as SystemHealth);
            break;
        }
      });

      if (failedLabels.length > 0) {
        setError(`Some admin sections failed to load: ${failedLabels.join(", ")}.`);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
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
    setAnalytics,
    setBookings,
    setCryptoTransactions,
    setError,
    setEventRegistrations,
    setEvents,
    setInquiries,
    setListings,
    setLoading,
    setOrders,
    setPayouts,
    setPosts,
    setProducts,
    setServiceBookings,
    setServices,
    setSettings,
    setSystemHealth,
    setUsers,
    users,
  };
};
