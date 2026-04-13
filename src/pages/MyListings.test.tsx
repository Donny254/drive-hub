import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyListings from "@/pages/MyListings";
import { useMyListingsManager, type Listing } from "@/hooks/useMyListingsManager";

vi.mock("@/components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: "token-1" }),
}));

vi.mock("@/lib/api", () => ({
  resolveImageUrl: (url: string) => url,
}));

vi.mock("@/hooks/useMyListingsManager", () => ({
  emptyListing: {
    id: "",
    title: "",
    priceCents: 0,
    listingType: "buy",
    featured: false,
    status: "pending_approval",
    year: new Date().getFullYear(),
    mileage: null,
    fuel: null,
    powerHp: null,
    imageUrl: null,
    description: "",
    location: "",
  },
  vehicleYears: [2026, 2025, 2024],
  useMyListingsManager: vi.fn(),
}));

const mockedUseMyListingsManager = vi.mocked(useMyListingsManager);

const listingFixture: Listing = {
  id: "listing-1",
  title: "Audi SQ5",
  priceCents: 100000,
  listingType: "buy",
  featured: false,
  status: "active",
  year: 2022,
  mileage: 1000,
  fuel: "Petrol",
  powerHp: 300,
  imageUrl: "/uploads/audi.webp",
  description: "Clean vehicle",
  location: "Nairobi",
};

describe("MyListings", () => {
  beforeEach(() => {
    mockedUseMyListingsManager.mockReset();
  });

  it("opens a delete confirmation dialog and deletes the selected listing", async () => {
    const deleteListing = vi.fn().mockResolvedValue(undefined);

    mockedUseMyListingsManager.mockReturnValue({
      addCreateImageUrl: vi.fn(),
      addEditImageUrl: vi.fn(),
      analytics: null,
      createImageUrl: "",
      createImages: [],
      createListing: vi.fn(),
      creatingListing: null,
      deleteListing,
      editImageUrl: "",
      editImages: [],
      editingListing: null,
      error: null,
      formError: null,
      handleUpload: vi.fn(),
      imageError: null,
      listings: [listingFixture],
      loading: false,
      openEdit: vi.fn(),
      removeCreateImage: vi.fn(),
      removeEditImage: vi.fn(),
      reorderEditImages: vi.fn(),
      saveListing: vi.fn(),
      setCreateImageUrl: vi.fn(),
      setCreateImages: vi.fn(),
      setCreatingListing: vi.fn(),
      setEditImageUrl: vi.fn(),
      setEditImages: vi.fn(),
      setEditingListing: vi.fn(),
      setFormError: vi.fn(),
      uploading: false,
    });

    render(<MyListings />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete listing?")).toBeInTheDocument();
    expect(screen.getByText(/This will permanently remove "Audi SQ5"/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Listing" }));

    await waitFor(() => {
      expect(deleteListing).toHaveBeenCalledWith("listing-1");
    });
  });
});
