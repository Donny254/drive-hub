import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BrandLogo from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";
import { toast } from "@/components/ui/sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDevResetUrl(null);

    try {
      const resp = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Unable to start password reset."));
      }

      const data = (await resp.json()) as { message?: string; devResetUrl?: string };
      const message = data.message || "If that email exists, we have sent password reset instructions.";
      setSuccess(message);
      setDevResetUrl(data.devResetUrl || null);
      toast.success("Password reset instructions sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start password reset.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyDevLink = async () => {
    if (!devResetUrl) return;
    try {
      await navigator.clipboard.writeText(devResetUrl);
      toast.success("Reset link copied.");
    } catch {
      toast.error("Unable to copy reset link.");
    }
  };

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
            <h1 className="text-center font-display text-3xl tracking-wider">Reset Password</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to choose a new password.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-500">{success}</p>}

              {devResetUrl && (
                <div className="space-y-3 rounded-lg border border-border bg-background/60 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Development Reset Link
                  </p>
                  <p className="break-all text-sm text-muted-foreground">{devResetUrl}</p>
                  <Button type="button" variant="outline" className="w-full" onClick={copyDevLink}>
                    Copy Reset Link
                  </Button>
                </div>
              )}

              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Back to{" "}
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

export default ForgotPassword;
