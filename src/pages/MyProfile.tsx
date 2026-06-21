import { useEffect, useState } from "react";
import AccountLayout from "@/components/shared/AccountLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
};

const MyProfile = () => {
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiFetch("/api/users/me", { headers: authHeaders, signal: controller.signal })
      .then(async (resp) => {
        if (!resp.ok) throw new Error("Failed to load profile");
        const data: Profile = await resp.json();
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error("Failed to load profile.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { name, phone };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const resp = await apiFetch("/api/users/me", {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save profile");
      }
      const updated: Profile = await resp.json();
      setProfile(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountLayout title="My Profile">
      <div className="max-w-xl space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {profile && (
          <>
            <Card className="rounded-2xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">Account details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input value={profile.email} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <span className="capitalize rounded-full bg-secondary px-2 py-0.5">{profile.role}</span>
                  <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">Change password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-1.5">
                  <Label>Current password</Label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="grid gap-1.5">
                  <Label>New password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Confirm new password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
                </div>
              </CardContent>
            </Card>

            <Button variant="hero" className="w-full max-w-xl" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        )}
      </div>
    </AccountLayout>
  );
};

export default MyProfile;
