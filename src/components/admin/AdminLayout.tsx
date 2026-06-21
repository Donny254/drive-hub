import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import AdminSidebar from "@/components/admin/AdminSidebar";

// Shared shell for the standalone admin pages so they keep the admin sidebar
// and navigation, matching the Admin dashboard.
const AdminLayout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex pt-20">
        {/* Desktop sidebar */}
        <aside className="fixed left-0 top-20 hidden h-[calc(100vh-5rem)] w-56 flex-col overflow-hidden border-r border-border bg-card lg:flex">
          <AdminSidebar />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-background/80" />
            <aside
              className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        <div className="min-w-0 flex-1 lg:pl-56">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="m-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm lg:hidden"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
