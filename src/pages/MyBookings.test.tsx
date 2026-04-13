import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyBookings from "@/pages/MyBookings";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

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
  apiFetch: vi.fn(),
  resolveImageUrl: (url: string) => url,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedToast = vi.mocked(toast);

const bookingsFixture = [
  {
    id: "booking-1",
    listingId: "listing-1",
    listingTitle: "Audi SQ5",
    listingImageUrl: "/uploads/audi.webp",
    startDate: "2026-03-20",
    endDate: "2026-03-22",
    status: "pending",
    paymentStatus: "pending",
    amountCents: 150000,
    createdAt: "2026-03-11T08:00:00.000Z",
  },
];

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

describe("MyBookings", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedToast.success.mockReset();
    mockedToast.error.mockReset();

    mockedApiFetch.mockImplementation(async (path, options) => {
      if (path === "/api/bookings" && !options?.method) {
        return jsonResponse(bookingsFixture);
      }
      if (path === "/api/bookings/booking-1" && options?.method === "PUT") {
        return jsonResponse({});
      }
      return jsonResponse({});
    });
  });

  it("opens a confirmation dialog and cancels a booking after confirmation", async () => {
    render(<MyBookings />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);

    expect(screen.getByText("Cancel booking?")).toBeInTheDocument();
    expect(screen.getByText(/This will cancel booking/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel Booking" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/bookings/booking-1",
        expect.objectContaining({
          method: "PUT",
          headers: { Authorization: "Bearer token-1" },
          body: JSON.stringify({ status: "cancelled" }),
        })
      );
    });

    expect(mockedToast.success).toHaveBeenCalledWith("Booking cancelled.");
  });
});
