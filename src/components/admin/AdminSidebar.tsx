import { Link, useLocation } from "react-router-dom";
import { NAV_GROUPS, QUICK_LINKS } from "./adminNav";

type AdminSidebarProps = {
  onNavigate?: () => void;
};

// Navigation-based admin sidebar for the standalone admin pages. Dashboard
// sections link to /admin?tab=<value> (Admin.tsx reads the tab from the query),
// quick links go straight to their pages.
const AdminSidebar = ({ onNavigate }: AdminSidebarProps) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const currentTab = location.pathname === "/admin" ? params.get("tab") || "overview" : null;

  const linkClass = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
      active
        ? "bg-primary/15 text-primary font-medium"
        : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
    }`;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70">Control Center</p>
        <h2 className="mt-0.5 font-display text-base">Admin</h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ value, label, icon: Icon }) => (
                <Link
                  key={value}
                  to={`/admin?tab=${value}`}
                  onClick={onNavigate}
                  className={linkClass(currentTab === value)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">Quick Links</p>
          <div className="space-y-0.5">
            {QUICK_LINKS.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} onClick={onNavigate} className={linkClass(location.pathname === to)}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AdminSidebar;
