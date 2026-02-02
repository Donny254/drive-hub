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
import { useAuth } from "@/context/AuthContext";

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-3xl text-primary tracking-wider">WheelsnationKe</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
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
                    <Link to="/my-listings">My Listings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-bookings">My Bookings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-event-registrations">Event Registrations</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-service-bookings">Service Bookings</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Theme Toggle & CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            {user?.role === "admin" && (
              <Link to="/admin">
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
                  <Button variant="secondary" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="hero" size="default">
                    Create Account
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="text-foreground"
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
                <Link
                  to="/my-listings"
                  onClick={() => setIsOpen(false)}
                  className={`font-medium text-sm uppercase tracking-widest py-2 ${
                    location.pathname === "/my-listings"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  My Listings
                </Link>
              )}
              {user && (
                <div className="rounded-lg border border-border bg-card/60 p-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">My Account</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to="/my-listings"
                      onClick={() => setIsOpen(false)}
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
                      className={`font-medium text-sm uppercase tracking-widest ${
                        location.pathname === "/my-event-registrations"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      Event Registrations
                    </Link>
                    <Link
                      to="/my-service-bookings"
                      onClick={() => setIsOpen(false)}
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
                <Link to="/admin" onClick={() => setIsOpen(false)}>
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
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="secondary" size="default" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setIsOpen(false)}>
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
