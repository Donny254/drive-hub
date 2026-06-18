import { useEffect, useMemo, useState } from "react";
import type { AdminAnalytics, CryptoTransaction, Listing, SystemHealth } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { resolveImageUrl } from "@/lib/api";
import { getCryptoExplorerUrl } from "@/lib/crypto";
import { toast } from "@/components/ui/sonner";
import { Activity, Car, Clock, Eye, MessageSquare, AlertTriangle, BadgeCheck, Coins, Download } from "lucide-react";

type AdminOverviewTabProps = {
  analytics: AdminAnalytics | null;
  flaggedMediaListings: Listing[];
  systemHealth: SystemHealth | null;
  cryptoTransactions: CryptoTransaction[];
  refreshingSystemHealth?: boolean;
  exportFinanceReport: () => void;
  exportFraudReport: () => void;
  exportSellerPerformanceReport: () => void;
  refreshSystemHealth: () => Promise<void> | void;
  openEdit: (listing: Listing) => Promise<void> | void;
  approveListing: (listing: Listing) => Promise<void> | void;
  openCryptoReview: (transaction: CryptoTransaction) => void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
};

const AdminOverviewTab = ({
  analytics,
  flaggedMediaListings,
  systemHealth,
  cryptoTransactions,
  refreshingSystemHealth = false,
  exportFinanceReport,
  exportFraudReport,
  exportSellerPerformanceReport,
  refreshSystemHealth,
  openEdit,
  approveListing,
  openCryptoReview,
  statusVariant,
}: AdminOverviewTabProps) => {
  const [now, setNow] = useState(() => Date.now());
  const pendingCryptoTransactions = useMemo(
    () => cryptoTransactions.filter((transaction) => transaction.status === "pending"),
    [cryptoTransactions]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const healthFreshnessLabel = useMemo(() => {
    if (!systemHealth?.time) return "Health check unavailable.";
    const checkedAt = new Date(systemHealth.time).getTime();
    if (Number.isNaN(checkedAt)) {
      return `Last health check: ${systemHealth.time}`;
    }

    const diffSeconds = Math.max(0, Math.floor((now - checkedAt) / 1000));
    if (diffSeconds < 5) return "Checked just now";
    if (diffSeconds < 60) return `Checked ${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Checked ${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    return `Checked ${diffHours}h ago`;
  }, [now, systemHealth?.time]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  return (
    <TabsContent value="overview" className="mt-4">
      {analytics && (
        <div className="grid gap-4">
          {systemHealth?.mail === "not_configured" && (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
              <AlertTitle>Email is not configured</AlertTitle>
              <AlertDescription>
                Password reset links, inquiry notifications, and ticket emails will be skipped until SMTP is configured.
              </AlertDescription>
            </Alert>
          )}

          {/* Reporting */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base">Reporting</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Export operational snapshots.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={exportFinanceReport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Finance
                </Button>
                <Button variant="secondary" size="sm" onClick={exportFraudReport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Fraud
                </Button>
                <Button variant="secondary" size="sm" onClick={exportSellerPerformanceReport}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Seller Performance
                </Button>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* System Status — full width on its own */}
            <Card className="col-span-full rounded-2xl sm:col-span-2 xl:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm">System Status</CardTitle>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void refreshSystemHealth()} disabled={refreshingSystemHealth}>
                    {refreshingSystemHealth ? "…" : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Database</span>
                  <Badge variant={systemHealth?.db === "ok" ? "default" : "destructive"} className="text-xs">
                    {systemHealth?.db === "ok" ? "OK" : "Down"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <Badge variant={systemHealth?.mail === "configured" ? "default" : "secondary"} className="text-xs">
                    {systemHealth?.mail === "configured" ? "Configured" : "Not set"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{healthFreshnessLabel}</p>
              </CardContent>
            </Card>

            {([
              { icon: Car,         color: "text-primary bg-primary/10",         label: "Live Listings",      value: analytics.summary.activeListings,         sub: `${analytics.summary.totalListings} total` },
              { icon: Clock,       color: "text-amber-400 bg-amber-400/10",     label: "Review Queue",       value: analytics.summary.pendingListings,        sub: `${analytics.summary.rejectedListings} rejected` },
              { icon: Eye,         color: "text-blue-400 bg-blue-400/10",       label: "Total Views",        value: analytics.summary.totalViews,             sub: `${analytics.summary.viewToInquiryRate}% to inquiry` },
              { icon: MessageSquare, color: "text-violet-400 bg-violet-400/10", label: "Inquiries",          value: analytics.summary.totalInquiries,         sub: `${analytics.summary.inquiryToBookingRate}% to booking` },
              { icon: AlertTriangle, color: "text-red-400 bg-red-400/10",       label: "Fraud Pressure",     value: analytics.summary.highRiskListings,       sub: `Avg risk ${analytics.summary.averageRiskScore}` },
              { icon: BadgeCheck,  color: "text-emerald-400 bg-emerald-400/10", label: "Verified Sellers",   value: analytics.summary.verifiedSellers,        sub: `${analytics.summary.confirmedBookings} confirmed bookings` },
              { icon: Coins,       color: "text-yellow-400 bg-yellow-400/10",   label: "Pending Crypto",     value: pendingCryptoTransactions.length,         sub: "Awaiting manual review" },
            ] as const).map(({ icon: Icon, color, label, value, sub }) => (
              <Card key={label} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">{value ?? "--"}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
                <Coins className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="font-display text-base">Crypto Review Queue</h2>
                <p className="text-xs text-muted-foreground">Review submitted transfer hashes and approve or reject.</p>
              </div>
            </div>
            {pendingCryptoTransactions.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">
                No pending crypto payments right now.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCryptoTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium capitalize">
                            {transaction.relationType.replaceAll("_", " ")} {transaction.reference}
                          </p>
                          {transaction.label ? (
                            <p className="mt-1 text-xs text-muted-foreground">{transaction.label}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="capitalize">
                            {transaction.asset}
                            {transaction.network ? ` • ${transaction.network}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            KES {(transaction.amountCents / 100).toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[260px] truncate font-mono text-xs">{transaction.transactionHash}</p>
                        {transaction.payerWallet ? (
                          <p className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                            {transaction.payerWallet}
                          </p>
                        ) : null}
                          {transaction.reviewNotes ? (
                            <p className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                              {transaction.reviewNotes}
                            </p>
                          ) : null}
                          {transaction.proofImageUrl ? (
                            <a
                              href={resolveImageUrl(transaction.proofImageUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs text-primary hover:underline"
                            >
                              View proof
                            </a>
                          ) : null}
                        </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => void copyText(transaction.transactionHash, "Transaction hash")}>
                            Copy Hash
                          </Button>
                          {transaction.walletAddress ? (
                            <Button variant="ghost" size="sm" onClick={() => void copyText(transaction.walletAddress!, "Wallet address")}>
                              Copy Wallet
                            </Button>
                          ) : null}
                          {getCryptoExplorerUrl(transaction.network, transaction.transactionHash) ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={getCryptoExplorerUrl(transaction.network, transaction.transactionHash) || "#"}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Explorer
                              </a>
                            </Button>
                          ) : null}
                          <Button variant="secondary" size="sm" onClick={() => openCryptoReview(transaction)}>
                            Review Payment
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-400/10 text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="font-display text-base">Top Risk Listings</h2>
                  <p className="text-xs text-muted-foreground">Highest-risk submissions to review first.</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Seller</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topRiskListings.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p>{item.title}</p>
                          {item.moderationNotes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.moderationNotes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{item.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>{item.riskScore}/100</TableCell>
                      <TableCell>{item.sellerName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-400/10 text-blue-400">
                  <Eye className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="font-display text-base">Top Viewed Listings</h2>
                  <p className="text-xs text-muted-foreground">Highest traffic and associated inquiry load.</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Inquiries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.topViewedListings.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.title}</TableCell>
                      <TableCell className="capitalize">{item.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>{item.viewsCount}</TableCell>
                      <TableCell>{item.inquiriesCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="font-display text-base">Media Review Queue</h2>
                <p className="text-xs text-muted-foreground">Listings needing image-quality or fraud review.</p>
              </div>
            </div>
            {flaggedMediaListings.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">
                No flagged media listings right now.
              </div>
            ) : (
              <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                {flaggedMediaListings.map((listing) => (
                  <div key={listing.id} className="rounded-xl border border-border bg-background/60 p-4">
                    {listing.imageUrl ? (
                      <img
                        src={resolveImageUrl(listing.imageUrl)}
                        alt={listing.title}
                        className="h-40 w-full rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                        No image
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium leading-tight">{listing.title}</p>
                        <Badge variant={statusVariant(listing.status)} className="capitalize">
                          {listing.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Risk score: {listing.riskScore ?? 0}/100</p>
                      <p className="text-xs text-muted-foreground">
                        {listing.riskFlags?.length
                          ? listing.riskFlags.join(", ")
                          : "Awaiting manual image review"}
                      </p>
                      {listing.moderationNotes && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{listing.moderationNotes}</p>
                      )}
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => openEdit(listing)}>
                        Review Listing
                      </Button>
                      {(listing.status === "pending_approval" || listing.status === "rejected") && (
                        <Button variant="hero" size="sm" className="w-full" onClick={() => approveListing(listing)}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </TabsContent>
  );
};

export default AdminOverviewTab;
