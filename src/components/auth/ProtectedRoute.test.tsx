import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AuthProvider } from "@/context/AuthContext";

const renderProtectedRoute = (initialEntry = "/admin") =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <div>Admin area</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects to login when a stored admin user has no token", async () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin",
        phone: null,
        role: "admin",
      })
    );

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Admin area")).not.toBeInTheDocument();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("renders protected content when both user and token are present", async () => {
    localStorage.setItem("auth_token", "token-1");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin",
        phone: null,
        role: "admin",
      })
    );

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText("Admin area")).toBeInTheDocument();
    });
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});
