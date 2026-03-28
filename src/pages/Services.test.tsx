import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Services from "@/pages/Services";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

vi.mock("@/components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("@/components/services/AdSlider", () => ({
  default: () => <div data-testid="ad-slider" />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Santos",
      email: "santos@example.com",
      phone: "0712345678",
      role: "user",
    },
    token: "token-1",
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

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

const servicesFixture = [
  {
    id: "service-1",
    title: "Detailing",
    description: "Premium detailing package",
    features: ["Wash", "Polish"],
    priceCents: 150000,
    imageUrl: null,
    active: true,
  },
];

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

describe("Services", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedToast.success.mockReset();
    mockedToast.error.mockReset();
    vi.setSystemTime(new Date("2026-04-10T10:00:00"));

    mockedApiFetch.mockImplementation(async (path) => {
      if (path === "/api/services?active=true") return jsonResponse(servicesFixture);
      return jsonResponse({});
    });
  });

  it("blocks selecting a past preferred date in the booking dialog", async () => {
    render(<Services />);

    await waitFor(() => {
      expect(screen.getByText("Detailing")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Book Now" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Select preferred date" }));

    expect(screen.getByRole("gridcell", { name: "9" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Select preferred date" })).toHaveTextContent(
      "Select preferred date",
    );
    expect(mockedToast.error).not.toHaveBeenCalled();
    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      "/api/service-bookings",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
