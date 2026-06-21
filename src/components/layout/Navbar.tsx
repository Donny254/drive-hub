import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/branding/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { prefetchRoute } from "@/lib/routePrefetch";
<<<<<<< HEAD
=======
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";
>>>>>>> 6bbb07c0a8e89f23f60f09ecbaff08c55bd61b02

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Market", path: "/market" },
  { name: "Services", path: "/services" },
  { name: "Events", path: "/events" },
  { name: "Store", path: "/store" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
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
              imageClassName="h-[4.5rem] max-w-[96px] sm:h-20 sm:max-w-[108px]"
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
              <Link to="/my-profile" onMouseEnter={prefetchLink("/my-profile")} onFocus={prefetchLink("/my-profile")}>
                <Button
                  variant="secondary"
                  size="sm"
                  className={location.pathname.startsWith("/my-") ? "border-primary text-primary" : ""}
                >
                  My Account
                </Button>
              </Link>
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
              <Button variant="hero" size="default" onClick={() => setLogoutOpen(true)}>
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
                <Link
                  to="/my-profile"
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={prefetchLink("/my-profile")}
                  onFocus={prefetchLink("/my-profile")}
                >
                  <Button variant="secondary" size="default" className="w-full">
                    My Account
                  </Button>
                </Link>
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
                  onClick={() => setLogoutOpen(true)}
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
      <ActionConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Sign out?"
        description="You will be signed out of your account."
        cancelLabel="Stay"
        confirmLabel="Sign Out"
        onConfirm={() => { logout(); setIsOpen(false); }}
      />
    </nav>
  );
};

export default Navbar;
