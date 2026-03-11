import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminListingEditor } from "@/hooks/useAdminListingEditor";
import { apiFetch, uploadImage } from "@/lib/api";
import type { Listing, ListingAuditEntry } from "@/components/admin/types";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  uploadImage: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUploadImage = vi.mocked(uploadImage);

const listingFixture: Listing = {
  id: "listing-1",
  title: "Audi SQ5",
  priceCents: 150000,
  listingType: "buy",
  featured: false,
  status: "pending_approval",
  year: 2021,
  mileage: 1200,
  fuel: "Petrol",
  powerHp: 320,
  imageUrl: "/uploads/original.webp",
  description: "Clean unit",
  location: "Nairobi",
};

const listingDetailsFixture: Listing = {
  ...listingFixture,
  moderationNotes: "Needs sharper photos",
  riskScore: 15,
  images: [
    { id: "img-1", url: "/uploads/original.webp" },
    { id: "img-2", url: "/uploads/extra.webp" },
  ],
};

const auditFixture: ListingAuditEntry[] = [
  {
    id: "audit-1",
    action: "listing_updated",
    details: {
      changedFields: ["imageUrl"],
      riskScore: 15,
    },
    createdAt: "2026-03-11T08:00:00.000Z",
    actor: {
      id: "admin-1",
      name: "Admin",
      email: "admin@wheelsnationke.co.ke",
      role: "admin",
    },
  },
];

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

describe("useAdminListingEditor", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedUploadImage.mockReset();

    mockedApiFetch.mockImplementation(async (path, options) => {
      if (path === `/api/listings/${listingFixture.id}/audit`) return jsonResponse(auditFixture);
      if (path === `/api/listings/${listingFixture.id}`) return jsonResponse(listingDetailsFixture);
      if (path === `/api/listings/${listingFixture.id}/images` && options?.method === "POST") {
        const body = JSON.parse(String(options.body));
        return jsonResponse({ id: "img-new", url: body.url });
      }
      return jsonResponse({});
    });

    mockedUploadImage.mockResolvedValue({ url: "/uploads/new-upload.webp" } as Awaited<ReturnType<typeof uploadImage>>);
  });

  it("loads audit trail and listing details when opening edit mode", async () => {
    const { result } = renderHook(() =>
      useAdminListingEditor({
        token: "token-1",
        authHeaders: { Authorization: "Bearer token-1" },
      })
    );

    await act(async () => {
      await result.current.openEdit(listingFixture);
    });

    await waitFor(() => {
      expect(result.current.listingAuditLoading).toBe(false);
      expect(result.current.editingListing?.moderationNotes).toBe("Needs sharper photos");
      expect(result.current.editImages).toEqual([
        { id: "img-1", url: "/uploads/original.webp" },
        { id: "img-2", url: "/uploads/extra.webp" },
      ]);
      expect(result.current.listingAudit).toEqual(auditFixture);
    });
  });

  it("sets the primary image for admin-created listings without posting image metadata", async () => {
    const { result } = renderHook(() =>
      useAdminListingEditor({
        token: "token-1",
        authHeaders: { Authorization: "Bearer token-1" },
      })
    );

    act(() => {
      result.current.setCreatingListing({ ...listingFixture, id: "", imageUrl: null });
    });

    await act(async () => {
      await result.current.handleUpload(new File(["img"], "car.jpg", { type: "image/jpeg" }), "create");
    });

    expect(result.current.creatingListing?.imageUrl).toBe("/uploads/new-upload.webp");
    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      `/api/listings/${listingFixture.id}/images`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uploads a new image for edited listings, appends it, and refreshes audit", async () => {
    const { result } = renderHook(() =>
      useAdminListingEditor({
        token: "token-1",
        authHeaders: { Authorization: "Bearer token-1" },
      })
    );

    act(() => {
      result.current.setEditingListing({ ...listingFixture });
      result.current.setEditImages([{ id: "img-1", url: "/uploads/original.webp" }]);
    });

    await act(async () => {
      await result.current.handleUpload(new File(["img"], "car.jpg", { type: "image/jpeg" }), "edit");
    });

    await waitFor(() => {
      expect(result.current.editingListing?.imageUrl).toBe("/uploads/new-upload.webp");
      expect(result.current.editImages).toEqual([
        { id: "img-1", url: "/uploads/original.webp" },
        { id: "img-new", url: "/uploads/new-upload.webp" },
      ]);
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `/api/listings/${listingFixture.id}/images`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "/uploads/new-upload.webp" }),
      })
    );
    expect(mockedApiFetch).toHaveBeenCalledWith(
      `/api/listings/${listingFixture.id}/audit`,
      expect.objectContaining({
        headers: { Authorization: "Bearer token-1" },
      })
    );
  });
});
