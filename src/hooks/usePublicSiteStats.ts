import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type PublicSiteStats = {
  totalCars: number;
  carsForSale: number;
  carsForRent: number;
  trustedDealers: number;
  countriesEstablished: number;
  carsSold: number;
  happyClients: number;
  eventsHosted: number;
  yearsExperience: number;
};

const usePublicSiteStats = () => {
  const [stats, setStats] = useState<PublicSiteStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadStats = async () => {
      try {
        const response = await apiFetch("/api/settings/public", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Unable to load homepage statistics (${response.status})`);
        }
        setStats((await response.json()) as PublicSiteStats);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Failed to load homepage statistics", error);
        }
      }
    };

    void loadStats();
    const refreshInterval = window.setInterval(() => void loadStats(), 30_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void loadStats();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      controller.abort();
    };
  }, []);

  return stats;
};

export default usePublicSiteStats;
