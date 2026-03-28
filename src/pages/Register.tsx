import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandLogo from "@/components/branding/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import PasswordField from "@/components/shared/PasswordField";
import { getPasswordValidationMessage, PASSWORD_MIN_LENGTH } from "@/lib/password";
import PasswordRequirements from "@/components/shared/PasswordRequirements";

const Register = () => {
  const navigate = useNavigate();
  const { register, user, hydrated } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      setError(passwordMessage);
      setLoading(false);
      return;
    }
    try {
      await register(name, email, phone, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setError(null);
    }
  }, [user]);

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
        <div className="container mx-auto px-4 max-w-md">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <div className="mb-6 flex justify-center">
              <BrandLogo
                className="gap-4"
                imageClassName="h-16 max-w-[240px] border border-border bg-white/95 p-2 sm:h-20 sm:max-w-[280px]"
                textClassName="hidden"
              />
            </div>
            <h1 className="font-display text-3xl tracking-wider text-center">Create Account</h1>
            <p className="text-muted-foreground text-sm text-center mt-2">
              Join WheelsnationKe to list and book cars.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordField
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  toggleLabel="password"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use at least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
                </p>
                <PasswordRequirements password={password} />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Already have an account?{" "}
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

export default Register;
