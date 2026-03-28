import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BrandLogo from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import PasswordField from "@/components/shared/PasswordField";
import { getPasswordValidationMessage, PASSWORD_MIN_LENGTH } from "@/lib/password";
import PasswordRequirements from "@/components/shared/PasswordRequirements";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const { user, hydrated } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      const message = "This password reset link is missing a token.";
      setError(message);
      toast.error(message);
      return;
    }

    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      const message = passwordMessage;
      setError(message);
      toast.error(message);
      return;
    }

    if (password !== confirmPassword) {
      const message = "Passwords do not match.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      const resp = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Unable to reset password."));
      }

      const data = (await resp.json()) as { message?: string };
      const message = data.message || "Password reset successful. You can now sign in.";
      setSuccess(message);
      toast.success("Password updated.");
      setPassword("");
      setConfirmPassword("");
      setRedirectCountdown(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reset password.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (redirectCountdown === null) return undefined;
    if (redirectCountdown <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setRedirectCountdown((current) => (current === null ? current : current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [navigate, redirectCountdown]);

  if (!hydrated) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto max-w-md px-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="mb-6 flex justify-center">
              <BrandLogo
                className="gap-4"
                imageClassName="h-16 max-w-[240px] border border-border bg-white/95 p-2 sm:h-20 sm:max-w-[280px]"
                textClassName="hidden"
              />
            </div>
            <h1 className="text-center font-display text-3xl tracking-wider">Choose New Password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Set a new password for your WheelsnationKe account.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <PasswordField
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  toggleLabel="new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <PasswordField
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  toggleLabel="confirm password"
                  required
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Use at least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
              </p>
              <PasswordRequirements password={password} />

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-500">{success}</p>}
              {success && redirectCountdown !== null && (
                <p className="text-xs text-muted-foreground">
                  Redirecting to sign in in {redirectCountdown}...
                </p>
              )}

              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Reset Password"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Return to{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
