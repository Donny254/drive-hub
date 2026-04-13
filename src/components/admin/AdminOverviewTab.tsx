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
    <TabsContent value="overview" className="mt-6">
      {analytics && (
        <div className="grid gap-8">
          {systemHealth?.mail === "not_configured" && (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
              <AlertTitle>Email is not configured</AlertTitle>
              <AlertDescription>
                Password reset links, inquiry notifications, and ticket emails will be skipped until SMTP is configured.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-xl tracking-wider">Reporting</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Export operational snapshots without digging through raw tables.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={exportFinanceReport}>
                  Export Finance CSV
                </Button>
                <Button variant="secondary" onClick={exportFraudReport}>
                  Export Fraud CSV
                </Button>
                <Button variant="secondary" onClick={exportSellerPerformanceReport}>
                  Export Seller Performance CSV
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">System Status</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void refreshSystemHealth()}
                    disabled={refreshingSystemHealth}
                  >
                    {refreshingSystemHealth ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <Badge variant={systemHealth?.db === "ok" ? "default" : "destructive"}>
                    {systemHealth?.db === "ok" ? "Connected" : "Down"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <Badge variant={systemHealth?.mail === "configured" ? "default" : "secondary"}>
                    {systemHealth?.mail === "configured" ? "Configured" : "Not configured"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {healthFreshnessLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {systemHealth?.time ? new Date(systemHealth.time).toLocaleString() : ""}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Live Listings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.activeListings}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analytics.summary.totalListings} total marketplace listings
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Review Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.pendingListings}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analytics.summary.rejectedListings} rejected
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Marketplace Views</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.totalViews}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analytics.summary.viewToInquiryRate}% view-to-inquiry
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inquiries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.totalInquiries}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analytics.summary.inquiryToBookingRate}% inquiry-to-booking
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fraud Pressure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.highRiskListings}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Avg risk {analytics.summary.averageRiskScore}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Verified Sellers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{analytics.summary.verifiedSellers}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analytics.summary.confirmedBookings} confirmed bookings
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pending Crypto Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{pendingCryptoTransactions.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Waiting for manual review and approval
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-display text-xl tracking-wider">Crypto Review Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review submitted transfer hashes and open the related admin editor to approve or reject payment.
              </p>
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
              <div className="border-b border-border px-6 py-4">
                <h2 className="font-display text-xl tracking-wider">Top Risk Listings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highest-risk submissions to review first.
                </p>
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
              <div className="border-b border-border px-6 py-4">
                <h2 className="font-display text-xl tracking-wider">Top Viewed Listings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highest traffic listings and associated inquiry load.
                </p>
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
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-display text-xl tracking-wider">Media Review Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Listings needing image-quality or fraud review first.
              </p>
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
