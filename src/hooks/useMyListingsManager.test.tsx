import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyListing, useMyListingsManager, type Listing } from "@/hooks/useMyListingsManager";
import { apiFetch, uploadImage } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  uploadImage: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUploadImage = vi.mocked(uploadImage);

const listingsFixture: Listing[] = [
  {
    id: "listing-1",
    title: "Audi SQ5",
    priceCents: 100000,
    listingType: "buy",
    featured: false,
    status: "active",
    year: 2021,
    mileage: 1000,
    fuel: "Petrol",
    powerHp: 300,
    imageUrl: "/uploads/audi.webp",
    description: "Clean unit",
    location: "Nairobi",
  },
];

const analyticsFixture = {
  summary: {
    totalListings: 1,
    activeListings: 1,
    pendingListings: 0,
    rejectedListings: 0,
    soldListings: 0,
    totalViews: 10,
    totalInquiries: 2,
    totalBookings: 1,
    confirmedBookings: 1,
    viewToInquiryRate: 20,
    inquiryToBookingRate: 50,
    inquiryToConfirmedRate: 50,
    averageRiskScore: 5,
  },
  topListings: [
    {
      id: "listing-1",
      title: "Audi SQ5",
      status: "active" as const,
      priceCents: 100000,
      viewsCount: 10,
      inquiriesCount: 2,
      bookingsCount: 1,
    },
  ],
};

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

class SmallImageMock {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  naturalWidth = 320;
  naturalHeight = 240;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("useMyListingsManager", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedUploadImage.mockReset();

    mockedApiFetch.mockImplementation(async (path) => {
      if (path === "/api/listings/me") return jsonResponse(listingsFixture);
      if (path === "/api/listings/analytics/me") return jsonResponse(analyticsFixture);
      return jsonResponse({});
    });

    mockedUploadImage.mockResolvedValue({ url: "/uploads/uploaded.webp" } as Awaited<ReturnType<typeof uploadImage>>);

    vi.stubGlobal("Image", SmallImageMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("loads listings and analytics on mount", async () => {
    const { result } = renderHook(() => useMyListingsManager({ token: "token-1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.listings).toEqual(listingsFixture);
    expect(result.current.analytics).toEqual(analyticsFixture);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/listings/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-1" },
      })
    );
  });

  it("rejects creating a listing without a primary image", async () => {
    const { result } = renderHook(() => useMyListingsManager({ token: "token-1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const draft: Listing = {
      ...emptyListing,
      title: "Audi",
      priceCents: 100000,
      year: 2022,
      location: "Nairobi",
      description: "Clean vehicle",
    };

    await expect(
      act(async () => {
        await result.current.createListing(draft);
      })
    ).rejects.toThrow("A primary image is required");

    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      "/api/listings",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("blocks undersized uploads before calling the upload API", async () => {
    const { result } = renderHook(() => useMyListingsManager({ token: "token-1" }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(["tiny"], "tiny.jpg", { type: "image/jpeg" });

    let uploadOk = true;
    await act(async () => {
      uploadOk = await result.current.handleUpload(file, "create");
    });

    expect(uploadOk).toBe(false);
    expect(result.current.formError).toBe("Image too small. Minimum size is 640x480px");
    expect(mockedUploadImage).not.toHaveBeenCalled();
  });
});
