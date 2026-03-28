import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "@/pages/ResetPassword";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();

vi.mock("@/components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("@/components/branding/BrandLogo", () => ({
  default: () => <div data-testid="brand-logo" />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    hydrated: true,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams("token=reset-token"), vi.fn()],
  };
});

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedApiFetch = vi.mocked(apiFetch);
const mockedToast = vi.mocked(toast);

describe("ResetPassword", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedToast.success.mockReset();
    mockedToast.error.mockReset();
    navigateMock.mockReset();
  });

  it("blocks weak passwords before calling the API", async () => {
    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    });

    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(mockedToast.error).toHaveBeenCalledWith("Password must be at least 8 characters.");
  });

  it("submits a valid reset and starts the sign-in countdown", async () => {
    vi.useFakeTimers();
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Password reset successful. You can now sign in." }),
    } as Response);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "Abcd1234" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "Abcd1234" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
      await Promise.resolve();
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/api/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "reset-token", password: "Abcd1234" }),
      }),
    );

    expect(mockedToast.success).toHaveBeenCalledWith("Password updated.");
    expect(screen.getByText(/Redirecting to sign in in 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm Password")).toHaveValue("");

    vi.useRealTimers();
  });
});
