import type { AdminAnalytics, Listing } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { resolveImageUrl } from "@/lib/api";

type AdminOverviewTabProps = {
  analytics: AdminAnalytics | null;
  flaggedMediaListings: Listing[];
  exportFinanceReport: () => void;
  exportFraudReport: () => void;
  exportSellerPerformanceReport: () => void;
  openEdit: (listing: Listing) => Promise<void> | void;
  approveListing: (listing: Listing) => Promise<void> | void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
};

const AdminOverviewTab = ({
  analytics,
  flaggedMediaListings,
  exportFinanceReport,
  exportFraudReport,
  exportSellerPerformanceReport,
  openEdit,
  approveListing,
  statusVariant,
}: AdminOverviewTabProps) => {
  return (
    <TabsContent value="overview" className="mt-6">
      {analytics && (
        <div className="grid gap-8">
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
