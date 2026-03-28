import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminEvents from "@/pages/AdminEvents";
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
  uploadImage: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedToast = vi.mocked(toast);

const eventsFixture = [
  {
    id: "event-1",
    title: "Cars and Coffee",
    description: "Saturday meetup",
    location: "Nairobi",
    startDate: "2026-04-05",
    endDate: "2026-04-05",
    imageUrl: null,
    priceCents: 0,
    status: "upcoming",
  },
];

const jsonResponse = (data: unknown, ok = true) => ({
  ok,
  json: async () => data,
});

describe("AdminEvents", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedToast.success.mockReset();
    mockedToast.error.mockReset();

    mockedApiFetch.mockImplementation(async (path, options) => {
      if (path === "/api/events" && !options?.method) return jsonResponse(eventsFixture);
      if (path === "/api/events/event-1" && options?.method === "PUT") return jsonResponse({});
      return jsonResponse({});
    });
  });

  it("saves an edited event and shows success feedback", async () => {
    render(<AdminEvents />);

    await waitFor(() => {
      expect(screen.getByText("Cars and Coffee")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByDisplayValue("Cars and Coffee");
    fireEvent.change(titleInput, { target: { value: "Cars and Coffee Reloaded" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/events/event-1",
        expect.objectContaining({
          method: "PUT",
          headers: { Authorization: "Bearer token-1" },
          body: expect.stringContaining("\"title\":\"Cars and Coffee Reloaded\""),
        })
      );
    });

    expect(mockedToast.success).toHaveBeenCalledWith("Event updated.");
  });
});
