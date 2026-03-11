import type { Dispatch, SetStateAction } from "react";
import type { SiteSettings } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AdminSettingsTabProps = {
  settings: SiteSettings | null;
  setSettings: Dispatch<SetStateAction<SiteSettings | null>>;
  saveSettings: () => Promise<void> | void;
};

const AdminSettingsTab = ({ settings, setSettings, saveSettings }: AdminSettingsTabProps) => {
  return (
    <TabsContent value="settings" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">Site Settings</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Update public contact details, social channels, and bank instructions from structured sections.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {settings && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <h3 className="font-medium">Company Contact</h3>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-2">
                      <Label>Company Name</Label>
                      <Input
                        value={settings.companyName ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, companyName: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Support Email</Label>
                      <Input
                        value={settings.supportEmail ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, supportEmail: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Support Phone</Label>
                      <Input
                        value={settings.supportPhone ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, supportPhone: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Address</Label>
                      <Input
                        value={settings.address ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <h3 className="font-medium">Social Channels</h3>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-2">
                      <Label>Facebook URL</Label>
                      <Input
                        value={settings.socialFacebook ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialFacebook: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Instagram URL</Label>
                      <Input
                        value={settings.socialInstagram ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialInstagram: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>X URL</Label>
                      <Input
                        value={settings.socialTwitter ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialTwitter: e.target.value } : prev))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>YouTube URL</Label>
                      <Input
                        value={settings.socialYoutube ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialYoutube: e.target.value } : prev))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/50 p-5">
                <h3 className="font-medium">Bank Transfer Details</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={settings.bankName ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankName: e.target.value } : prev))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Account Name</Label>
                    <Input
                      value={settings.bankAccountName ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankAccountName: e.target.value } : prev))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Account Number</Label>
                    <Input
                      value={settings.bankAccountNumber ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankAccountNumber: e.target.value } : prev))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Branch</Label>
                    <Input
                      value={settings.bankBranch ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankBranch: e.target.value } : prev))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Swift</Label>
                    <Input
                      value={settings.bankSwift ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankSwift: e.target.value } : prev))}
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Bank Instructions</Label>
                    <Textarea
                      value={settings.bankInstructions ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, bankInstructions: e.target.value } : prev))}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="hero" onClick={saveSettings} disabled={!settings}>
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminSettingsTab;
