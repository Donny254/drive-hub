type Prefetcher = () => Promise<unknown>;

const routePrefetchers: Record<string, Prefetcher> = {
  "/market": () => import("@/pages/Market"),
  "/services": () => import("@/pages/Services"),
  "/events": () => import("@/pages/Events"),
  "/store": () => import("@/pages/Store"),
  "/login": () => import("@/pages/Login"),
  "/register": () => import("@/pages/Register"),
  "/admin": () => import("@/pages/Admin"),
  "/my-listings": () => import("@/pages/MyListings"),
  "/my-bookings": () => import("@/pages/MyBookings"),
  "/my-event-registrations": () => import("@/pages/MyEventRegistrations"),
  "/my-service-bookings": () => import("@/pages/MyServiceBookings"),
};

const prefetchedRoutes = new Set<string>();

export const prefetchRoute = (path: string) => {
  const prefetcher = routePrefetchers[path];
  if (!prefetcher || prefetchedRoutes.has(path)) return;

  prefetchedRoutes.add(path);
  prefetcher().catch(() => {
    prefetchedRoutes.delete(path);
  });
};

export const prefetchRoutes = (paths: string[]) => {
  for (const path of paths) {
    prefetchRoute(path);
  }
};

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };

export const prefetchOnIdle = (paths: string[], timeout = 2000) => {
  if (typeof window === "undefined") return;

  const run = () => prefetchRoutes(paths);
  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(run, { timeout });
    return;
  }

  window.setTimeout(run, 350);
};
