import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MarketSlider from "@/components/market/MarketSlider";
import AdSlider from "@/components/services/AdSlider";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  resolveImageUrl: (url: string) => url,
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("slider image fallbacks", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("restores the original market slider picture when uploaded images are returned", async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "market-1",
          title: "MARKET",
          description: "A market listing",
          ctaLink: "/market",
          imageUrl: "/uploads/uploaded-market.webp",
        },
      ],
    } as never);

    const { container } = render(
      <MemoryRouter>
        <MarketSlider />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector("h2")?.textContent).toBe("MARKET");
    });

    expect(container.innerHTML).not.toContain("/uploads/");
    expect(container.innerHTML).toContain("images.unsplash.com/photo-1614162692292-7ac56d7f7f1e");
  });

  it("restores the original service slider picture when uploaded images are returned", async () => {
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "service-1",
          title: "SERVICE SUPPORT",
          description: "A service listing",
          ctaLink: "/services",
          imageUrl: "/uploads/uploaded-service.webp",
        },
      ],
    } as never);

    const { container } = render(
      <MemoryRouter>
        <AdSlider />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector("h2")?.textContent).toBe("SERVICE SUPPORT");
    });

    expect(container.innerHTML).not.toContain("/uploads/");
    expect(container.innerHTML).toContain("images.unsplash.com/photo-1503376780353-7e6692767b70");
  });
});
