import { useState, type Dispatch, type SetStateAction } from "react";
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
  testMpesaConnection: (settings: SiteSettings) => Promise<{
    environment: string;
    message: string;
  }>;
};

const AdminSettingsTab = ({
  settings,
  setSettings,
  saveSettings,
  testMpesaConnection,
}: AdminSettingsTabProps) => {
  const [testingMpesa, setTestingMpesa] = useState(false);
  const [mpesaTestResult, setMpesaTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestMpesaConnection = async () => {
    if (!settings || testingMpesa) return;

    setTestingMpesa(true);
    setMpesaTestResult(null);

    try {
      const result = await testMpesaConnection(settings);
      setMpesaTestResult({
        success: true,
        message: result.message,
      });
    } catch (error) {
      setMpesaTestResult({
        success: false,
        message: error instanceof Error ? error.message : "M-Pesa connection test failed.",
      });
    } finally {
      setTestingMpesa(false);
    }
  };

  const homepageStats = [
    { key: "trustedDealers", label: "Trusted Dealers" },
    { key: "countriesEstablished", label: "Countries Established" },
    { key: "carsSold", label: "Cars Sold" },
    { key: "happyClients", label: "Happy Clients" },
    { key: "eventsHosted", label: "Events Hosted" },
    { key: "yearsExperience", label: "Years Experience" },
  ] as const;

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
              <div className="rounded-2xl border border-border bg-background/50 p-5">
                <h3 className="font-medium">Homepage Statistics</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update the public figures shown on the homepage. Cars Uploaded is calculated live from all non-deleted vehicle listings.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="homepage-cars-uploaded">Cars Uploaded (live)</Label>
                    <Input id="homepage-cars-uploaded" value="Calculated from listings" disabled />
                  </div>
                  {homepageStats.map(({ key, label }) => (
                    <div className="grid gap-2" key={key}>
                      <Label htmlFor={`homepage-${key}`}>{label}</Label>
                      <Input
                        id={`homepage-${key}`}
                        type="number"
                        min="0"
                        step="1"
                        value={settings[key]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isSafeInteger(value) || value < 0) return;
                          setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

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
                      <Label>Pinterest URL</Label>
                      <Input
                        value={settings.socialPinterest ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialPinterest: e.target.value } : prev))}
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
                      <Label>TikTok URL</Label>
                      <Input
                        value={settings.socialTikTok ?? ""}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, socialTikTok: e.target.value } : prev))}
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

                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <h3 className="font-medium">Seller Payouts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set the commission rate that is held back from booking payouts before seller settlement.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Commission Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={settings.sellerCommissionRate ?? 0}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, sellerCommissionRate: Number.parseInt(e.target.value || "0", 10) || 0 } : prev
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

              <div className="rounded-2xl border border-border bg-background/50 p-5">
                <h3 className="font-medium">Crypto Payment Details</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure one or both networks. Customers will see wallet connection buttons for whichever networks are configured.
                </p>

                <div className="mt-4 space-y-5">
                  {/* TRC20 / TronLink */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">TRC20 — TronLink</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Currency</Label>
                        <Input
                          value={settings.cryptoCurrency ?? ""}
                          onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoCurrency: e.target.value } : prev))}
                          placeholder="USDT"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Network</Label>
                        <Input
                          value={settings.cryptoNetwork ?? ""}
                          onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoNetwork: e.target.value } : prev))}
                          placeholder="TRC20"
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>TRC20 Wallet Address</Label>
                        <Input
                          value={settings.cryptoWalletAddress ?? ""}
                          onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoWalletAddress: e.target.value } : prev))}
                          placeholder="T..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* EVM / MetaMask */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">EVM — MetaMask (ETH / BSC / Polygon…)</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2 md:col-span-2">
                        <Label>EVM Network</Label>
                        <Input
                          value={settings.cryptoNetworkEvm ?? ""}
                          onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoNetworkEvm: e.target.value } : prev))}
                          placeholder="bsc  /  ethereum  /  polygon"
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>EVM Wallet Address</Label>
                        <Input
                          value={settings.cryptoWalletAddressEvm ?? ""}
                          onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoWalletAddressEvm: e.target.value } : prev))}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  <div className="grid gap-2">
                    <Label>Crypto Instructions</Label>
                    <Textarea
                      value={settings.cryptoInstructions ?? ""}
                      onChange={(e) => setSettings((prev) => (prev ? { ...prev, cryptoInstructions: e.target.value } : prev))}
                      placeholder="Send payment, then paste the transaction hash and payer wallet for manual confirmation."
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/50 p-5">
                <h3 className="font-medium">M-Pesa (Daraja) Configuration</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select which Daraja environment processes payments. Each environment has
                  independent credentials. Secrets are encrypted at rest; leave secret fields
                  blank to retain their saved values.
                </p>

                <div className="mt-4 grid gap-2">
                  <Label htmlFor="mpesa-environment">Active Environment</Label>
                  <select
                    id="mpesa-environment"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={settings.mpesaEnvironment ?? "default"}
                    onChange={(event) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              mpesaEnvironment:
                                event.target.value === "default"
                                  ? null
                                  : event.target.value as "sandbox" | "production",
                            }
                          : prev
                      )
                    }
                  >
                    <option value="default">Default — use server MPESA_ENV</option>
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Default uses the server environment variable. Sandbox and Production
                    explicitly select their respective credentials.
                  </p>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <section className="space-y-4 rounded-xl border border-border p-4">
                    <div>
                      <h4 className="font-medium">Sandbox Credentials</h4>
                      <p className="text-xs text-muted-foreground">
                        Used when Sandbox is selected.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Sandbox Business Shortcode</Label>
                      <Input
                        value={settings.mpesaSandboxShortcode ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaSandboxShortcode: e.target.value } : prev)}
                        placeholder="Sandbox shortcode"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Sandbox Party B</Label>
                      <Input
                        value={settings.mpesaSandboxPartyb ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaSandboxPartyb: e.target.value } : prev)}
                        placeholder="Sandbox Party B"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mpesa-sandbox-type">
                        Sandbox Account Type
                      </Label>
                      <select
                        id="mpesa-sandbox-type"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={
                          settings.mpesaSandboxTransactionType ||
                          "CustomerPayBillOnline"
                        }
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mpesaSandboxTransactionType:
                                    event.target.value as
                                      | "CustomerPayBillOnline"
                                      | "CustomerBuyGoodsOnline",
                                }
                              : prev
                          )
                        }
                      >
                        <option value="CustomerPayBillOnline">PayBill</option>
                        <option value="CustomerBuyGoodsOnline">
                          Buy Goods / Till
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Sandbox Consumer Key {settings.mpesaSandboxConsumerKeySet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaSandboxConsumerKey ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaSandboxConsumerKey: e.target.value } : prev)}
                        placeholder={settings.mpesaSandboxConsumerKeySet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Sandbox Consumer Secret {settings.mpesaSandboxConsumerSecretSet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaSandboxConsumerSecret ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaSandboxConsumerSecret: e.target.value } : prev)}
                        placeholder={settings.mpesaSandboxConsumerSecretSet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Sandbox Passkey {settings.mpesaSandboxPasskeySet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaSandboxPasskey ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaSandboxPasskey: e.target.value } : prev)}
                        placeholder={settings.mpesaSandboxPasskeySet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                  </section>

                  <section className="space-y-4 rounded-xl border border-border p-4">
                    <div>
                      <h4 className="font-medium">Production Credentials</h4>
                      <p className="text-xs text-muted-foreground">
                        Used when Production is selected. These credentials are never
                        automatically copied from Sandbox.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Production Business Shortcode</Label>
                      <Input
                        value={settings.mpesaProductionShortcode ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaProductionShortcode: e.target.value } : prev)}
                        placeholder="Production shortcode"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Production Party B</Label>
                      <Input
                        value={settings.mpesaProductionPartyb ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaProductionPartyb: e.target.value } : prev)}
                        placeholder="Production Party B"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mpesa-production-type">
                        Production Account Type
                      </Label>
                      <select
                        id="mpesa-production-type"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={
                          settings.mpesaProductionTransactionType ||
                          "CustomerPayBillOnline"
                        }
                        onChange={(event) =>
                          setSettings((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mpesaProductionTransactionType:
                                    event.target.value as
                                      | "CustomerPayBillOnline"
                                      | "CustomerBuyGoodsOnline",
                                }
                              : prev
                          )
                        }
                      >
                        <option value="CustomerPayBillOnline">PayBill</option>
                        <option value="CustomerBuyGoodsOnline">
                          Buy Goods / Till
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Production Consumer Key {settings.mpesaProductionConsumerKeySet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaProductionConsumerKey ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaProductionConsumerKey: e.target.value } : prev)}
                        placeholder={settings.mpesaProductionConsumerKeySet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Production Consumer Secret {settings.mpesaProductionConsumerSecretSet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaProductionConsumerSecret ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaProductionConsumerSecret: e.target.value } : prev)}
                        placeholder={settings.mpesaProductionConsumerSecretSet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Production Passkey {settings.mpesaProductionPasskeySet ? "✓ saved" : ""}</Label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={settings.mpesaProductionPasskey ?? ""}
                        onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaProductionPasskey: e.target.value } : prev)}
                        placeholder={settings.mpesaProductionPasskeySet ? "Saved — leave blank to keep" : "Not set"}
                      />
                    </div>
                  </section>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Shared Account Reference</Label>
                    <Input
                      value={settings.mpesaAccountReference ?? ""}
                      onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaAccountReference: e.target.value } : prev)}
                      placeholder="e.g. WHEELSNATION"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shared Transaction Description</Label>
                    <Input
                      value={settings.mpesaTransactionDesc ?? ""}
                      onChange={(e) => setSettings((prev) => prev ? { ...prev, mpesaTransactionDesc: e.target.value } : prev)}
                    />
                  </div>
                </div>
              </div>            </>
          )}
          <div className="flex flex-col gap-3">
            {mpesaTestResult && (
              <div
                role="status"
                className={`rounded-lg border p-3 text-sm ${
                  mpesaTestResult.success
                    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {mpesaTestResult.message}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestMpesaConnection}
                disabled={!settings || testingMpesa}
              >
                {testingMpesa ? "Testing connection..." : "Test M-Pesa Connection"}
              </Button>

              <Button variant="hero" onClick={saveSettings} disabled={!settings}>
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminSettingsTab;
