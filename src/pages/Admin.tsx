import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

type Listing = {
  id: string;
  title: string;
  priceCents: number;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "active" | "sold" | "inactive";
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  description: string | null;
  location: string | null;
  images?: Array<{ id: string; url: string }>;
};

type Order = {
  id: string;
  userId: string;
  totalCents: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
  itemsCount?: number;
};

type OrderItem = {
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

type Booking = {
  id: string;
  userId: string;
  listingId: string;
  listingTitle: string | null;
  listingImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "pending" | "confirmed" | "cancelled" | "rejected";
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed";
  amountCents?: number | null;
  createdAt: string;
};

type ServiceBooking = {
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

type EventRegistration = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

type Inquiry = {
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

type Service = {
  id: string;
  title: string;
  description: string | null;
  features: string[];
  priceCents: number | null;
  imageUrl: string | null;
  active: boolean;
};

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  status: "upcoming" | "past" | "cancelled";
};

type Product = {
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

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
};

type User = {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  createdAt: string;
};

const formatMoney = (cents?: number | null) => {
  if (cents === null || cents === undefined) return "--";
  return `KES ${(cents / 100).toLocaleString()}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
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
  const { token } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingListing, setEditingListing] = useState<Listing | null>(null);
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
  const [uploading, setUploading] = useState(false);
  const [editImages, setEditImages] = useState<Array<{ id: string; url: string }>>([]);
  const [editImageUrl, setEditImageUrl] = useState("");

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

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

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listingsRes, ordersRes, usersRes, bookingsRes, serviceBookingsRes, eventRegistrationsRes, inquiriesRes, servicesRes, eventsRes, productsRes, postsRes] = await Promise.all([
        apiFetch("/api/listings?status=active"),
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
    } catch (err) {
      console.error(err);
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveListing = async () => {
    if (!editingListing) return;
    const resp = await apiFetch(`/api/listings/${editingListing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingListing),
    });
    if (!resp.ok) {
      throw new Error("Failed to update listing");
    }
    setEditingListing(null);
    fetchAll();
  };

  const saveOrder = async () => {
    if (!editingOrder) return;
    const resp = await apiFetch(`/api/orders/${editingOrder.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: editingOrder.status, totalCents: editingOrder.totalCents }),
    });
    if (!resp.ok) {
      throw new Error("Failed to update order");
    }
    setEditingOrder(null);
    fetchAll();
  };

  const loadOrderDetails = async (orderId: string) => {
    try {
      setOrderDetailsOpen(true);
      setOrderDetails(null);
      setOrderDetailsError(null);
      setOrderDetailsLoading(true);
      const resp = await apiFetch(`/api/orders/${orderId}`, { headers: authHeaders });
      if (!resp.ok) {
        throw new Error("Failed to load order details");
      }
      const data = await resp.json();
      setOrderDetails({ order: data, items: data.items || [] });
    } catch (err) {
      console.error(err);
      setOrderDetailsError("Failed to load order details.");
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const saveBooking = async () => {
    if (!editingBooking) return;
    const resp = await apiFetch(`/api/bookings/${editingBooking.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: editingBooking.status }),
    });
    if (!resp.ok) {
      throw new Error("Failed to update booking");
    }
    setEditingBooking(null);
    fetchAll();
  };

  const saveServiceBooking = async () => {
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
    if (!resp.ok) {
      throw new Error("Failed to update service booking");
    }
    setEditingServiceBooking(null);
    fetchAll();
  };

  const saveEventRegistration = async () => {
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
    if (!resp.ok) {
      throw new Error("Failed to update event registration");
    }
    setEditingEventRegistration(null);
    fetchAll();
  };

  const saveInquiry = async () => {
    if (!editingInquiry) return;
    const resp = await apiFetch(`/api/inquiries/${editingInquiry.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: editingInquiry.status }),
    });
    if (!resp.ok) {
      throw new Error("Failed to update inquiry");
    }
    setEditingInquiry(null);
    fetchAll();
  };

  const createService = async () => {
    if (!creatingService) return;
    const resp = await apiFetch("/api/services", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingService),
    });
    if (!resp.ok) throw new Error("Failed to create service");
    setCreatingService(null);
    fetchAll();
  };

  const saveService = async () => {
    if (!editingService) return;
    const resp = await apiFetch(`/api/services/${editingService.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingService),
    });
    if (!resp.ok) throw new Error("Failed to update service");
    setEditingService(null);
    fetchAll();
  };

  const deleteService = async (id: string) => {
    const resp = await apiFetch(`/api/services/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete service");
    fetchAll();
  };

  const createEvent = async () => {
    if (!creatingEvent) return;
    const resp = await apiFetch("/api/events", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingEvent),
    });
    if (!resp.ok) throw new Error("Failed to create event");
    setCreatingEvent(null);
    fetchAll();
  };

  const saveEvent = async () => {
    if (!editingEvent) return;
    const resp = await apiFetch(`/api/events/${editingEvent.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingEvent),
    });
    if (!resp.ok) throw new Error("Failed to update event");
    setEditingEvent(null);
    fetchAll();
  };

  const deleteEvent = async (id: string) => {
    const resp = await apiFetch(`/api/events/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete event");
    fetchAll();
  };

  const createProduct = async () => {
    if (!creatingProduct) return;
    const resp = await apiFetch("/api/products", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingProduct),
    });
    if (!resp.ok) throw new Error("Failed to create product");
    setCreatingProduct(null);
    fetchAll();
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    const resp = await apiFetch(`/api/products/${editingProduct.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingProduct),
    });
    if (!resp.ok) throw new Error("Failed to update product");
    setEditingProduct(null);
    fetchAll();
  };

  const deleteProduct = async (id: string) => {
    const resp = await apiFetch(`/api/products/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete product");
    fetchAll();
  };

  const createPost = async () => {
    if (!creatingPost) return;
    const resp = await apiFetch("/api/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creatingPost),
    });
    if (!resp.ok) throw new Error("Failed to create post");
    setCreatingPost(null);
    fetchAll();
  };

  const savePost = async () => {
    if (!editingPost) return;
    const resp = await apiFetch(`/api/posts/${editingPost.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editingPost),
    });
    if (!resp.ok) throw new Error("Failed to update post");
    setEditingPost(null);
    fetchAll();
  };

  const deletePost = async (id: string) => {
    const resp = await apiFetch(`/api/posts/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete post");
    fetchAll();
  };

  const saveUser = async () => {
    if (!editingUser) return;
    const resp = await apiFetch(`/api/users/${editingUser.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ name: editingUser.name, role: editingUser.role }),
    });
    if (!resp.ok) {
      throw new Error("Failed to update user");
    }
    setEditingUser(null);
    fetchAll();
  };

  const deleteListing = async (id: string) => {
    const resp = await apiFetch(`/api/listings/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete listing");
    fetchAll();
  };

  const deleteOrder = async (id: string) => {
    const resp = await apiFetch(`/api/orders/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete order");
    fetchAll();
  };

  const deleteBooking = async (id: string) => {
    const resp = await apiFetch(`/api/bookings/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete booking");
    fetchAll();
  };

  const deleteUser = async (id: string) => {
    const resp = await apiFetch(`/api/users/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete user");
    fetchAll();
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const result = await uploadImage(file, token);
      setEditingListing((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
      if (editingListing?.id) {
        const addResp = await apiFetch(`/api/listings/${editingListing.id}/images`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ url: result.url }),
        });
        if (addResp.ok) {
          const added = await addResp.json();
          setEditImages((prev) => [...prev, { id: added.id, url: added.url }]);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const openEdit = async (listing: Listing) => {
    setEditingListing({ ...listing });
    setEditImages([]);
    try {
      const resp = await apiFetch(`/api/listings/${listing.id}`);
      if (resp.ok) {
        const data = (await resp.json()) as Listing;
        const images = data.images?.map((img) => ({ id: img.id, url: img.url })) ?? [];
        setEditImages(images);
        setEditingListing((prev) => (prev ? { ...prev, ...data } : prev));
      }
    } catch {
      // ignore
    }
  };

  const removeEditImage = async (image: { id: string; url: string }) => {
    if (!editingListing) return;
    await apiFetch(`/api/listings/${editingListing.id}/images/${image.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    setEditImages((prev) => prev.filter((item) => item.url !== image.url));
    if (editingListing.imageUrl === image.url) {
      const nextUrl = editImages.find((item) => item.url !== image.url)?.url || null;
      setEditingListing({ ...editingListing, imageUrl: nextUrl });
    }
  };

  const reorderEditImages = async (nextImages: Array<{ id: string; url: string }>) => {
    if (!editingListing) return;
    setEditImages(nextImages);
    await apiFetch(`/api/listings/${editingListing.id}/images/reorder`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ imageIds: nextImages.map((img) => img.id) }),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl tracking-wider">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage listings, orders, and users in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Link to="/admin/services" className="border border-border rounded-xl p-4 bg-card hover:border-primary/60 transition">
              <h3 className="font-display text-lg">Services</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage service offerings</p>
            </Link>
            <Link to="/admin/events" className="border border-border rounded-xl p-4 bg-card hover:border-primary/60 transition">
              <h3 className="font-display text-lg">Events</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage event listings</p>
            </Link>
            <Link to="/admin/products" className="border border-border rounded-xl p-4 bg-card hover:border-primary/60 transition">
              <h3 className="font-display text-lg">Store Products</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage merch products</p>
            </Link>
            <Link to="/admin/posts" className="border border-border rounded-xl p-4 bg-card hover:border-primary/60 transition">
              <h3 className="font-display text-lg">Blog Posts</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage blog content</p>
            </Link>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading admin data...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <Tabs defaultValue="listings">
                <TabsList>
                  <TabsTrigger value="listings">Listings</TabsTrigger>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="service-bookings">Service Bookings</TabsTrigger>
                  <TabsTrigger value="event-registrations">Event Registrations</TabsTrigger>
                  <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                  <TabsTrigger value="services">Services</TabsTrigger>
                  <TabsTrigger value="events">Events</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="posts">Blog</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                </TabsList>

                <TabsContent value="listings" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Image</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listings.map((listing) => (
                          <TableRow key={listing.id}>
                            <TableCell>
                              {listing.imageUrl ? (
                                <img
                                  src={resolveImageUrl(listing.imageUrl)}
                                  alt={listing.title}
                                  className="h-12 w-16 rounded-md object-cover border border-border"
                                />
                              ) : (
                                <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                              )}
                            </TableCell>
                            <TableCell>{listing.title}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {listing.listingType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(listing.status)} className="capitalize">
                                {listing.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatMoney(listing.priceCents)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => openEdit(listing)}
                                    >
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Edit Listing</DialogTitle>
                                    </DialogHeader>
                                    {editingListing && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Title</Label>
                                          <Input
                                            value={editingListing.title}
                                            onChange={(e) =>
                                              setEditingListing({ ...editingListing, title: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Price (KES)</Label>
                                          <Input
                                            type="number"
                                            value={editingListing.priceCents / 100}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                priceCents: Math.round(Number(e.target.value || 0) * 100),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Type</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingListing.listingType}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                listingType: e.target.value as Listing["listingType"],
                                              })
                                            }
                                          >
                                            <option value="buy">Buy</option>
                                            <option value="rent">Rent</option>
                                            <option value="sell">Sell</option>
                                          </select>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Status</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingListing.status}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                status: e.target.value as Listing["status"],
                                              })
                                            }
                                          >
                                            <option value="active">Active</option>
                                            <option value="sold">Sold</option>
                                            <option value="inactive">Inactive</option>
                                          </select>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Year</Label>
                                          <Input
                                            type="number"
                                            value={editingListing.year ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                year: e.target.value ? Number(e.target.value) : null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Mileage (mi)</Label>
                                          <Input
                                            type="number"
                                            value={editingListing.mileage ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                mileage: e.target.value ? Number(e.target.value) : null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Fuel</Label>
                                          <Input
                                            value={editingListing.fuel ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                fuel: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Power (HP)</Label>
                                          <Input
                                            type="number"
                                            value={editingListing.powerHp ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                powerHp: e.target.value ? Number(e.target.value) : null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Location</Label>
                                          <Input
                                            value={editingListing.location ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                location: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Description</Label>
                                          <Input
                                            value={editingListing.description ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                description: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Featured</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingListing.featured ? "yes" : "no"}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                featured: e.target.value === "yes",
                                              })
                                            }
                                          >
                                            <option value="no">No</option>
                                            <option value="yes">Yes</option>
                                          </select>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Image URL</Label>
                                          <Input
                                            value={editingListing.imageUrl ?? ""}
                                            onChange={(e) =>
                                              setEditingListing({
                                                ...editingListing,
                                                imageUrl: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Add Image URL</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              value={editImageUrl}
                                              onChange={(e) => setEditImageUrl(e.target.value)}
                                            />
                                            <Button
                                              type="button"
                                              variant="secondary"
                                              onClick={async () => {
                                                if (!editImageUrl.trim() || !editingListing.id) return;
                                            const url = editImageUrl.trim();
                                            const addResp = await apiFetch(`/api/listings/${editingListing.id}/images`, {
                                              method: "POST",
                                              headers: authHeaders,
                                              body: JSON.stringify({ url }),
                                            });
                                            if (addResp.ok) {
                                              const added = await addResp.json();
                                              setEditImages((prev) => [...prev, { id: added.id, url: added.url }]);
                                            }
                                            setEditImageUrl("");
                                          }}
                                        >
                                              Add
                                            </Button>
                                          </div>
                                        </div>
                                        {editImages.length > 0 && (
                                          <div className="grid gap-2">
                                            <Label>Images</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                              {editImages.map((img, index) => (
                                                <div key={img.id ?? img.url} className="relative">
                                                  <img
                                                    src={resolveImageUrl(img.url)}
                                                    alt="Listing"
                                                    className="h-20 w-full rounded-md object-cover border border-border"
                                                  />
                                                  <button
                                                    type="button"
                                                    className="absolute top-1 left-1 rounded-full bg-background/80 px-2 text-xs"
                                                    draggable
                                                    onDragStart={(e) => {
                                                      e.dataTransfer.setData("text/plain", String(index));
                                                    }}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => {
                                                      e.preventDefault();
                                                      const from = Number(e.dataTransfer.getData("text/plain"));
                                                      if (Number.isNaN(from) || from === index) return;
                                                      const next = [...editImages];
                                                      const [moved] = next.splice(from, 1);
                                                      next.splice(index, 0, moved);
                                                      reorderEditImages(next);
                                                    }}
                                                  >
                                                    ↕
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="absolute top-1 right-1 rounded-full bg-background/80 px-2 text-xs"
                                                    onClick={() => removeEditImage(img)}
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {editingListing.imageUrl && (
                                          <div className="grid gap-2">
                                            <Label>Preview</Label>
                                            <img
                                              src={resolveImageUrl(editingListing.imageUrl)}
                                              alt="Listing preview"
                                              className="w-full h-40 object-cover rounded-md border border-border"
                                            />
                                          </div>
                                        )}
                                        <div className="grid gap-2">
                                          <Label>Upload Image</Label>
                                          <Input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={async (e) => {
                                              const files = e.target.files ? Array.from(e.target.files) : [];
                                              for (const file of files) {
                                                await handleUpload(file);
                                              }
                                            }}
                                            disabled={uploading}
                                          />
                                          {uploading && (
                                            <p className="text-sm text-muted-foreground">Uploading...</p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button
                                        variant="hero"
                                        onClick={async () => {
                                          await saveListing();
                                        }}
                                      >
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    await deleteListing(listing.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>{order.id.slice(0, 8)}</TableCell>
                            <TableCell>{order.userId.slice(0, 8)}</TableCell>
                            <TableCell>{order.itemsCount ?? 0}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(order.status)} className="capitalize">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatMoney(order.totalCents)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => loadOrderDetails(order.id)}
                                >
                                  View
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingOrder({ ...order })}
                                    >
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Order</DialogTitle>
                                    </DialogHeader>
                                    {editingOrder && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Total (cents)</Label>
                                          <Input
                                            type="number"
                                            value={editingOrder.totalCents}
                                            onChange={(e) =>
                                              setEditingOrder({
                                                ...editingOrder,
                                                totalCents: Number(e.target.value),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Status</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingOrder.status}
                                            onChange={(e) =>
                                              setEditingOrder({
                                                ...editingOrder,
                                                status: e.target.value as Order["status"],
                                              })
                                            }
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="paid">Paid</option>
                                            <option value="cancelled">Cancelled</option>
                                            <option value="refunded">Refunded</option>
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button variant="hero" onClick={saveOrder}>
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    await deleteOrder(order.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                      </DialogHeader>
                      {orderDetailsLoading && (
                        <p className="text-muted-foreground">Loading order details...</p>
                      )}
                      {orderDetailsError && (
                        <p className="text-sm text-destructive">{orderDetailsError}</p>
                      )}
                      {orderDetails && (
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <p className="text-sm text-muted-foreground">
                              Order ID: {orderDetails.order.id}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              User: {orderDetails.order.userId}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              Status: {orderDetails.order.status}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Total: {(orderDetails.order.totalCents / 100).toLocaleString()}
                            </p>
                          </div>

                          {orderDetails.items.length === 0 ? (
                            <p className="text-muted-foreground">No items recorded for this order.</p>
                          ) : (
                            <div className="rounded-lg border border-border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Price</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orderDetails.items.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>
                                        <div className="flex items-center gap-3">
                                          {item.imageUrl ? (
                                            <img
                                              src={resolveImageUrl(item.imageUrl)}
                                              alt={item.name}
                                              className="h-10 w-10 rounded-md object-cover border border-border"
                                            />
                                          ) : (
                                            <div className="h-10 w-10 rounded-md border border-dashed border-border bg-secondary/40" />
                                          )}
                                          <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            {item.size && (
                                              <p className="text-xs text-muted-foreground">
                                                Size: {item.size}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>{item.quantity}</TableCell>
                                      <TableCell>{formatMoney(item.priceCents)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="hero" onClick={() => setOrderDetailsOpen(false)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TabsContent>

                <TabsContent value="bookings" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Image</TableHead>
                          <TableHead>Booking</TableHead>
                          <TableHead>Listing</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>
                              {booking.listingImageUrl ? (
                                <img
                                  src={resolveImageUrl(booking.listingImageUrl)}
                                  alt={booking.listingTitle ?? "Listing"}
                                  className="h-12 w-16 rounded-md object-cover border border-border"
                                />
                              ) : (
                                <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                              )}
                            </TableCell>
                            <TableCell>{booking.id.slice(0, 8)}</TableCell>
                            <TableCell>{booking.listingTitle ?? booking.listingId.slice(0, 8)}</TableCell>
                            <TableCell>{booking.userId.slice(0, 8)}</TableCell>
                            <TableCell>{booking.startDate ?? "--"}</TableCell>
                            <TableCell>{booking.endDate ?? "--"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusVariant(booking.paymentStatus ?? "pending")}
                                className="capitalize"
                              >
                                {booking.paymentStatus ?? "unpaid"}
                              </Badge>
                              {booking.amountCents
                                ? ` • ${formatMoney(booking.amountCents)}`
                                : ""}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(booking.status)} className="capitalize">
                                {booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingBooking({ ...booking })}
                                    >
                                      Update
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Update Booking</DialogTitle>
                                    </DialogHeader>
                                    {editingBooking && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Status</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingBooking.status}
                                            onChange={(e) =>
                                              setEditingBooking({
                                                ...editingBooking,
                                                status: e.target.value as Booking["status"],
                                              })
                                            }
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Approved</option>
                                            <option value="rejected">Rejected</option>
                                            <option value="cancelled">Cancelled</option>
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button variant="hero" onClick={saveBooking}>
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    await deleteBooking(booking.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="service-bookings" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Scheduled</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceBookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>{booking.id.slice(0, 8)}</TableCell>
                            <TableCell>{booking.userId?.slice(0, 8) ?? "--"}</TableCell>
                            <TableCell>{booking.serviceTitle ?? booking.serviceId.slice(0, 8)}</TableCell>
                            <TableCell>{booking.scheduledDate ?? "--"}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(booking.status)} className="capitalize">
                                {booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingServiceBooking({ ...booking })}
                                    >
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Service Booking</DialogTitle>
                                    </DialogHeader>
                                    {editingServiceBooking && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Status</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingServiceBooking.status}
                                            onChange={(e) =>
                                              setEditingServiceBooking({
                                                ...editingServiceBooking,
                                                status: e.target.value as ServiceBooking["status"],
                                              })
                                            }
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="cancelled">Cancelled</option>
                                          </select>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Scheduled Date</Label>
                                          <Input
                                            type="date"
                                            value={editingServiceBooking.scheduledDate ?? ""}
                                            onChange={(e) =>
                                              setEditingServiceBooking({
                                                ...editingServiceBooking,
                                                scheduledDate: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Notes</Label>
                                          <Textarea
                                            value={editingServiceBooking.notes ?? ""}
                                            onChange={(e) =>
                                              setEditingServiceBooking({
                                                ...editingServiceBooking,
                                                notes: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button variant="hero" onClick={saveServiceBooking}>
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="event-registrations" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registration</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Tickets</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventRegistrations.map((registration) => (
                          <TableRow key={registration.id}>
                            <TableCell>{registration.id.slice(0, 8)}</TableCell>
                            <TableCell>{registration.userId?.slice(0, 8) ?? "--"}</TableCell>
                            <TableCell>
                              {registration.eventTitle ?? registration.eventId.slice(0, 8)}
                            </TableCell>
                            <TableCell>{registration.tickets}</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusVariant(registration.status)}
                                className="capitalize"
                              >
                                {registration.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingEventRegistration({ ...registration })}
                                    >
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Event Registration</DialogTitle>
                                    </DialogHeader>
                                    {editingEventRegistration && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Status</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingEventRegistration.status}
                                            onChange={(e) =>
                                              setEditingEventRegistration({
                                                ...editingEventRegistration,
                                                status: e.target.value as EventRegistration["status"],
                                              })
                                            }
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="cancelled">Cancelled</option>
                                          </select>
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Tickets</Label>
                                          <Input
                                            type="number"
                                            min={1}
                                            value={editingEventRegistration.tickets}
                                            onChange={(e) =>
                                              setEditingEventRegistration({
                                                ...editingEventRegistration,
                                                tickets: Math.max(1, Number(e.target.value || 1)),
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Notes</Label>
                                          <Textarea
                                            value={editingEventRegistration.notes ?? ""}
                                            onChange={(e) =>
                                              setEditingEventRegistration({
                                                ...editingEventRegistration,
                                                notes: e.target.value || null,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button variant="hero" onClick={saveEventRegistration}>
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="inquiries" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Listing</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inquiries.map((inquiry) => (
                          <TableRow key={inquiry.id}>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {inquiry.inquiryType}
                              </Badge>
                            </TableCell>
                            <TableCell>{inquiry.name ?? "--"}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{inquiry.email ?? "--"}</div>
                                <div className="text-muted-foreground">{inquiry.phone ?? "--"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {inquiry.listingTitle ?? (inquiry.listingId ? inquiry.listingId.slice(0, 8) : "--")}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{inquiry.message ?? "--"}</TableCell>
                            <TableCell>{formatDate(inquiry.createdAt)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusVariant(inquiry.status)}
                                className="capitalize"
                              >
                                {inquiry.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditingInquiry({ ...inquiry })}
                                  >
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Inquiry</DialogTitle>
                                  </DialogHeader>
                                  {editingInquiry && (
                                    <div className="grid gap-4">
                                      <div className="grid gap-2">
                                        <Label>Status</Label>
                                        <select
                                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                          value={editingInquiry.status}
                                          onChange={(e) =>
                                            setEditingInquiry({
                                              ...editingInquiry,
                                              status: e.target.value as Inquiry["status"],
                                            })
                                          }
                                        >
                                          <option value="open">Open</option>
                                          <option value="handled">Handled</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                  <DialogFooter>
                                    <Button variant="hero" onClick={saveInquiry}>
                                      Save
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="mt-6">
                  <div className="rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.name ?? "--"}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingUser({ ...user })}
                                    >
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit User</DialogTitle>
                                    </DialogHeader>
                                    {editingUser && (
                                      <div className="grid gap-4">
                                        <div className="grid gap-2">
                                          <Label>Name</Label>
                                          <Input
                                            value={editingUser.name ?? ""}
                                            onChange={(e) =>
                                              setEditingUser({ ...editingUser, name: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label>Role</Label>
                                          <select
                                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                            value={editingUser.role}
                                            onChange={(e) =>
                                              setEditingUser({
                                                ...editingUser,
                                                role: e.target.value as User["role"],
                                              })
                                            }
                                          >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                    <DialogFooter>
                                      <Button variant="hero" onClick={saveUser}>
                                        Save
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    await deleteUser(user.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
