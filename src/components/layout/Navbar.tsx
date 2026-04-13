import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/branding/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { prefetchRoute } from "@/lib/routePrefetch";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Market", path: "/market" },
  { name: "Services", path: "/services" },
  { name: "Events", path: "/events" },
  { name: "Store", path: "/store" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const prefetchLink = (path: string) => () => prefetchRoute(path);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="min-w-0 shrink-0">
            <BrandLogo
              imageClassName="h-10 max-w-[170px] sm:h-12 sm:max-w-[220px]"
              textClassName="hidden"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onMouseEnter={prefetchLink(link.path)}
                onFocus={prefetchLink(link.path)}
                onTouchStart={prefetchLink(link.path)}
                className={`font-medium text-sm uppercase tracking-widest transition-colors duration-300 ${
                  location.pathname === link.path
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.name}
              </Link>
            ))}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    My Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-listings"
                      onMouseEnter={prefetchLink("/my-listings")}
                      onFocus={prefetchLink("/my-listings")}
                    >
                      My Listings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-bookings"
                      onMouseEnter={prefetchLink("/my-bookings")}
                      onFocus={prefetchLink("/my-bookings")}
                    >
                      My Bookings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-event-registrations"
                      onMouseEnter={prefetchLink("/my-event-registrations")}
                      onFocus={prefetchLink("/my-event-registrations")}
                    >
                      Event Registrations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-payments"
                      onMouseEnter={prefetchLink("/my-payments")}
                      onFocus={prefetchLink("/my-payments")}
                    >
                      Payments Center
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-payouts"
                      onMouseEnter={prefetchLink("/my-payouts")}
                      onFocus={prefetchLink("/my-payouts")}
                    >
                      Payouts
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/my-service-bookings"
                      onMouseEnter={prefetchLink("/my-service-bookings")}
                      onFocus={prefetchLink("/my-service-bookings")}
                    >
                      Service Bookings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Theme Toggle & CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            {user?.role === "admin" && (
              <Link
                to="/admin"
                onMouseEnter={prefetchLink("/admin")}
                onFocus={prefetchLink("/admin")}
              >
                <Button variant="secondary" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <Button variant="hero" size="default" onClick={logout}>
                Sign Out
              </Button>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="secondary"
                    size="sm"
                    onMouseEnter={prefetchLink("/login")}
                    onFocus={prefetchLink("/login")}
                  >
                    Sign In
                  </Button>
                </Link>
                <Link
                  to="/register"
                  onMouseEnter={prefetchLink("/register")}
                  onFocus={prefetchLink("/register")}
                >
                  <Button variant="hero" size="default">
                    Create Account
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              className="rounded-md p-1 text-foreground"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={prefetchLink(link.path)}
                  onFocus={prefetchLink(link.path)}
                  onTouchStart={prefetchLink(link.path)}
                  className={`font-medium text-sm uppercase tracking-widest py-2 ${
                    location.pathname === link.path
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {user && (
                <div className="rounded-lg border border-border bg-card/60 p-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">My Account</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to="/my-listings"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-listings")}
                      onFocus={prefetchLink("/my-listings")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-listings"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      My Listings
                    </Link>
                    <Link
                      to="/my-bookings"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-bookings")}
                      onFocus={prefetchLink("/my-bookings")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-bookings"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      My Bookings
                    </Link>
                    <Link
                      to="/my-event-registrations"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-event-registrations")}
                      onFocus={prefetchLink("/my-event-registrations")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-event-registrations"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                      >
                        Event Registrations
                      </Link>
                    <Link
                      to="/my-payments"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-payments")}
                      onFocus={prefetchLink("/my-payments")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-payments"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      Payments Center
                    </Link>
                    <Link
                      to="/my-payouts"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-payouts")}
                      onFocus={prefetchLink("/my-payouts")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-payouts"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      Payouts
                    </Link>
                    <Link
                      to="/my-service-bookings"
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={prefetchLink("/my-service-bookings")}
                      onFocus={prefetchLink("/my-service-bookings")}
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-service-bookings"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      Service Bookings
                    </Link>
                  </div>
                </div>
              )}
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={prefetchLink("/admin")}
                  onFocus={prefetchLink("/admin")}
                >
                  <Button variant="secondary" size="default" className="w-full">
                    Admin
                  </Button>
                </Link>
              )}
              {user ? (
                <Button
                  variant="hero"
                  size="default"
                  className="w-full"
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                >
                  Sign Out
                </Button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={prefetchLink("/login")}
                    onFocus={prefetchLink("/login")}
                  >
                    <Button variant="secondary" size="default" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={prefetchLink("/register")}
                    onFocus={prefetchLink("/register")}
                  >
                    <Button variant="hero" size="default" className="w-full">
                      Create Account
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
