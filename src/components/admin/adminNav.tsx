import {
  LayoutDashboard,
  Car,
  CalendarCheck,
  Coins,
  Banknote,
  Wrench,
  Ticket,
  MessageSquare,
  Settings2,
  CalendarDays,
  Package,
  FileText,
  ShoppingBag,
  Users,
  Settings,
  Megaphone,
} from "lucide-react";

// Shared admin navigation definitions, used by both the in-dashboard sidebar
// (Admin.tsx) and the standalone admin pages (via AdminSidebar / AdminLayout).
export const NAV_GROUPS = [
  {
    label: "Dashboard",
    items: [{ value: "overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Marketplace",
    items: [
      { value: "listings", label: "Listings", icon: Car },
      { value: "inquiries", label: "Inquiries", icon: MessageSquare },
    ],
  },
  {
    label: "Transactions",
    items: [
      { value: "orders", label: "Orders", icon: ShoppingBag },
      { value: "bookings", label: "Bookings", icon: CalendarCheck },
      { value: "crypto-payments", label: "Crypto Payments", icon: Coins },
      { value: "payouts", label: "Payouts", icon: Banknote },
      { value: "service-bookings", label: "Svc Bookings", icon: Wrench },
      { value: "event-registrations", label: "Event Regs", icon: Ticket },
    ],
  },
  {
    label: "Content",
    items: [
      { value: "services", label: "Services", icon: Settings2 },
      { value: "events", label: "Events", icon: CalendarDays },
      { value: "products", label: "Products", icon: Package },
      { value: "posts", label: "Blog", icon: FileText },
    ],
  },
  {
    label: "Admin",
    items: [
      { value: "users", label: "Users", icon: Users },
      { value: "settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export const QUICK_LINKS = [
  { to: "/admin/services", icon: Wrench, label: "Services" },
  { to: "/admin/events", icon: CalendarDays, label: "Events" },
  { to: "/admin/products", icon: Package, label: "Products" },
  { to: "/admin/adverts", icon: Megaphone, label: "Adverts" },
  { to: "/admin/posts", icon: FileText, label: "Blog" },
] as const;
