import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const Market = lazy(() => import("./pages/Market"));
const Services = lazy(() => import("./pages/Services"));
const Events = lazy(() => import("./pages/Events"));
const Store = lazy(() => import("./pages/Store"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const MyListings = lazy(() => import("./pages/MyListings"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const MyServiceBookings = lazy(() => import("./pages/MyServiceBookings"));
const MyEventRegistrations = lazy(() => import("./pages/MyEventRegistrations"));
const MyCryptoPayments = lazy(() => import("./pages/MyCryptoPayments"));
const MyPayouts = lazy(() => import("./pages/MyPayouts"));
const ListingDetails = lazy(() => import("./pages/ListingDetails"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const AdminServices = lazy(() => import("./pages/AdminServices"));
const AdminEvents = lazy(() => import("./pages/AdminEvents"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const AdminPosts = lazy(() => import("./pages/AdminPosts"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const EventDetails = lazy(() => import("./pages/EventDetails"));

const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
    Loading...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/market/:id" element={<ListingDetails />} />
              <Route path="/sellers/:id" element={<SellerProfile />} />
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
                path="/my-payments"
                element={
                  <ProtectedRoute roles={["user", "admin"]}>
                    <MyCryptoPayments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-crypto-payments"
                element={
                  <ProtectedRoute roles={["user", "admin"]}>
                    <MyCryptoPayments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-payouts"
                element={
                  <ProtectedRoute roles={["user", "admin"]}>
                    <MyPayouts />
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
