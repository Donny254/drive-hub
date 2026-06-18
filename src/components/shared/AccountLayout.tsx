import { type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import {
  User, Car, ShoppingBag, CalendarCheck, Wrench,
  Ticket, Coins, Banknote, Menu, LayoutDashboard,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/my-profile",              label: "My Profile",         icon: User,          group: "Account" },
  { to: "/my-listings",             label: "My Listings",        icon: Car,           group: "Account" },
  { to: "/my-orders",               label: "My Orders",          icon: ShoppingBag,   group: "Purchases" },
  { to: "/my-bookings",             label: "My Bookings",        icon: CalendarCheck, group: "Purchases" },
  { to: "/my-service-bookings",     label: "Service Bookings",   icon: Wrench,        group: "Purchases" },
  { to: "/my-event-registrations",  label: "Event Registrations",icon: Ticket,        group: "Purchases" },
  { to: "/my-crypto-payments",      label: "Crypto Payments",    icon: Coins,         group: "Payments" },
  { to: "/my-payouts",              label: "My Payouts",         icon: Banknote,      group: "Payments" },
] as const;

const GROUPS = ["Account", "Purchases", "Payments"] as const;

interface AccountLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function AccountLayout({ children, title, description }: AccountLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = NAV_ITEMS.find((i) => i.to === location.pathname);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* User panel */}
      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70">My Account</p>
        <p className="mt-1 font-display text-base truncate">{user?.name || user?.email || "User"}</p>
        {user?.email && user?.name && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{user.email}</p>
        )}
        <div className="mt-2.5 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary capitalize">
          {user?.role ?? "user"}
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          return (
            <div key={group}>
              <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">{group}</p>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to || (to === "/my-crypto-payments" && location.pathname === "/my-payments");
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                        active
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
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

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside
              className="absolute left-0 top-0 h-full w-56 border-r border-border bg-card pt-20"
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-h-[calc(100vh-5rem)] flex-1 lg:ml-56">
          {/* Sticky page header */}
          <div className="sticky top-20 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6">
              <button
                type="button"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-border/40 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open account menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LayoutDashboard className="h-3.5 w-3.5 lg:hidden" />
                <span>My Account</span>
                <span>/</span>
                <span className="font-medium text-foreground">{currentPath?.label ?? title}</span>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="px-4 py-6 md:px-6">
            {description && (
              <p className="mb-6 text-sm text-muted-foreground">{description}</p>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
