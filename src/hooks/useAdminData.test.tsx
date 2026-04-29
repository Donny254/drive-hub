import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminData } from "@/hooks/useAdminData";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

describe("useAdminData", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();

    mockedApiFetch.mockImplementation(async (path) => {
      if (path === "/api/orders") return jsonResponse({}, false);
      if (path === "/api/settings") return jsonResponse({ companyName: "Drive Hub" });
      if (path === "/api/listings/analytics/admin") {
        return jsonResponse({
          summary: {
            totalListings: 1,
            activeListings: 1,
            pendingListings: 0,
            rejectedListings: 0,
            soldListings: 0,
            highRiskListings: 0,
            averageRiskScore: 0,
            totalViews: 0,
            totalInquiries: 0,
            totalBookings: 0,
            confirmedBookings: 0,
            verifiedSellers: 0,
            viewToInquiryRate: 0,
            inquiryToBookingRate: 0,
            inquiryToConfirmedRate: 0,
          },
          topRiskListings: [],
          topViewedListings: [],
        });
      }
      return jsonResponse([]);
    });
  });

  it("keeps successful sections loaded when one request fails", async () => {
    const { result } = renderHook(() => useAdminData({ token: "token-1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.listings).toEqual([]);
    expect(result.current.settings).toEqual({ companyName: "Drive Hub" });
    expect(result.current.analytics?.summary.totalListings).toBe(1);
    expect(result.current.error).toBe("Some admin sections failed to load: orders.");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-1" },
      })
    );
  });

  it("stops early when there is no auth token", async () => {
    const { result } = renderHook(() => useAdminData({ token: null }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Missing admin auth token.");
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });
});
