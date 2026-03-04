import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Market from "./pages/Market";
import Services from "./pages/Services";
import Events from "./pages/Events";
import Store from "./pages/Store";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/Admin";
import MyListings from "./pages/MyListings";
import MyBookings from "./pages/MyBookings";
import MyServiceBookings from "./pages/MyServiceBookings";
import MyEventRegistrations from "./pages/MyEventRegistrations";
import ListingDetails from "./pages/ListingDetails";
import AdminServices from "./pages/AdminServices";
import AdminEvents from "./pages/AdminEvents";
import AdminProducts from "./pages/AdminProducts";
import AdminPosts from "./pages/AdminPosts";
import BlogPost from "./pages/BlogPost";
import EventDetails from "./pages/EventDetails";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/market" element={<Market />} />
            <Route path="/services" element={<Services />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/blog/:id" element={<BlogPost />} />
            <Route path="/store" element={<Store />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/market/:id" element={<ListingDetails />} />
            <Route
              path="/my-listings"
              element={
                <ProtectedRoute roles={["user", "admin"]}>
                  <MyListings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute roles={["user", "admin"]}>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-service-bookings"
              element={
                <ProtectedRoute roles={["user", "admin"]}>
                  <MyServiceBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-event-registrations"
              element={
                <ProtectedRoute roles={["user", "admin"]}>
                  <MyEventRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminServices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/posts"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminPosts />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
