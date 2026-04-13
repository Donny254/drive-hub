import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { emptyListing, useMyListingsManager, vehicleYears, type Listing } from "@/hooks/useMyListingsManager";
import { resolveImageUrl } from "@/lib/api";
import SellerListingDialog from "@/components/listings/SellerListingDialog";
import { useState } from "react";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

const MyListings = () => {
  const { token } = useAuth();
  const {
    addCreateImageUrl,
    addEditImageUrl,
    analytics,
    createImageUrl,
    createImages,
    createListing,
    creatingListing,
    deleteListing,
    editImageUrl,
    editImages,
    editingListing,
    error,
    formError,
    handleUpload,
    imageError,
    listings,
    loading,
    openEdit,
    removeCreateImage,
    removeEditImage,
    reorderEditImages,
    saveListing,
    setCreateImageUrl,
    setCreateImages,
    setCreatingListing,
    setEditImageUrl,
    setEditImages,
    setEditingListing,
    setFormError,
    uploading,
  } = useMyListingsManager({ token });
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-wider">My Listings</h1>
              <p className="text-muted-foreground mt-1">
                Create listings, respond to moderation feedback, and resubmit for approval.
              </p>
            </div>
            <Dialog
              open={Boolean(creatingListing)}
              onOpenChange={(open) => {
                if (!open) {
                  setCreatingListing(null);
                  setCreateImages([]);
                  setCreateImageUrl("");
                  setFormError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="hero"
                  onClick={() => {
                    setFormError(null);
                    setCreateImages([]);
                    setCreateImageUrl("");
                    setCreatingListing({ ...emptyListing });
                  }}
                >
                  New Listing
                </Button>
              </DialogTrigger>
              {creatingListing ? (
                <SellerListingDialog
                  title="Create Listing"
                  listing={creatingListing}
                  setListing={setCreatingListing}
                  formError={formError}
                  imageError={imageError}
                  vehicleYears={vehicleYears}
                  statusNote="New listings now go through admin review before they appear publicly. Add complete details and at least one strong primary image to reduce approval delays."
                  imageUrlValue={createImageUrl}
                  setImageUrlValue={setCreateImageUrl}
                  addImageUrl={addCreateImageUrl}
                  images={createImages}
                  removeImage={removeCreateImage}
                  uploading={uploading}
                  onUploadFiles={async (files) => {
                    for (const file of files) {
                      const ok = await handleUpload(file, "create");
                      if (!ok) break;
                    }
                  }}
                  onSubmit={async () => {
                    await createListing(creatingListing);
                  }}
                  submitLabel="Create"
                />
              ) : null}
            </Dialog>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading listings...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <>
                {analytics && (
                  <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Live Inventory</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.activeListings}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {analytics.summary.totalListings} total listings
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pipeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.pendingListings}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {analytics.summary.rejectedListings} rejected, {analytics.summary.soldListings} sold
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Views</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.totalViews}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {analytics.summary.viewToInquiryRate}% view-to-inquiry rate
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Inquiries</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.totalInquiries}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Buyer interest across your listings
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Conversion</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.inquiryToConfirmedRate}%</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {analytics.summary.confirmedBookings} confirmed bookings from inquiries
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Average Risk</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{analytics.summary.averageRiskScore}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Lower is better for approval speed
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {analytics && analytics.topListings.length > 0 && (
                  <div className="mb-8 rounded-xl border border-border bg-card">
                    <div className="border-b border-border px-6 py-4">
                      <h2 className="font-display text-xl tracking-wider">Top Performing Listings</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Listings sorted by inquiries and booking activity.
                      </p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Inquiries</TableHead>
                          <TableHead>Bookings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.topListings.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.title}</TableCell>
                            <TableCell className="capitalize">
                              {item.status.replaceAll("_", " ")}
                            </TableCell>
                            <TableCell>KES {(item.priceCents / 100).toLocaleString()}</TableCell>
                            <TableCell>{item.viewsCount}</TableCell>
                            <TableCell>{item.inquiriesCount}</TableCell>
                            <TableCell>{item.bookingsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Moderation</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          {listing.imageUrl ? (
                            <img
                              src={resolveImageUrl(listing.imageUrl)}
                              alt={listing.title}
                              className="h-12 w-16 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                          )}
                        </TableCell>
                        <TableCell>{listing.title}</TableCell>
                        <TableCell className="capitalize">{listing.listingType}</TableCell>
                        <TableCell className="capitalize">{listing.status.replaceAll("_", " ")}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{listing.riskScore ?? 0}</span>
                            <span className="text-muted-foreground"> / 100</span>
                          </div>
                        </TableCell>
                        <TableCell>{listing.moderationNotes ?? "--"}</TableCell>
                        <TableCell>KES {(listing.priceCents / 100).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog
                              open={editingListing?.id === listing.id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setEditingListing(null);
                                  setEditImages([]);
                                  setEditImageUrl("");
                                  setFormError(null);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEdit(listing)}
                                >
                                  Edit
                                </Button>
                              </DialogTrigger>
                              {editingListing ? (
                                <SellerListingDialog
                                  title="Edit Listing"
                                  listing={editingListing}
                                  setListing={setEditingListing}
                                  formError={formError}
                                  imageError={imageError}
                                  vehicleYears={vehicleYears}
                                  statusNote="Seller edits resubmit this listing for review automatically."
                                  reviewNote={
                                    editingListing.moderationNotes
                                      ? `Admin feedback: ${editingListing.moderationNotes}`
                                      : editingListing.riskFlags && editingListing.riskFlags.length > 0
                                        ? `Quality flags: ${editingListing.riskFlags.join(", ")}`
                                        : `Risk score: ${editingListing.riskScore ?? 0}/100`
                                  }
                                  imageUrlValue={editImageUrl}
                                  setImageUrlValue={setEditImageUrl}
                                  addImageUrl={addEditImageUrl}
                                  images={editImages}
                                  removeImage={async (image) => {
                                    if (typeof image !== "string") await removeEditImage(image);
                                  }}
                                  reorderImages={reorderEditImages}
                                  uploading={uploading}
                                  onUploadFiles={async (files) => {
                                    for (const file of files) {
                                      const ok = await handleUpload(file, "edit");
                                      if (!ok) break;
                                    }
                                  }}
                                  onSubmit={async () => {
                                    await saveListing(editingListing);
                                  }}
                                  submitLabel="Save"
                                />
                              ) : null}
                            </Dialog>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(listing)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <ActionConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete listing?"
        description={`This will permanently remove ${deleteTarget?.title ? `"${deleteTarget.title}"` : "this listing"}. This action cannot be undone.`}
        cancelLabel="Keep Listing"
        confirmLabel="Delete Listing"
        loading={deleteLoading}
        loadingLabel="Deleting..."
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            setDeleteLoading(true);
            await deleteListing(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleteLoading(false);
          }
        }}
      />
      <Footer />
    </div>
  );
};

export default MyListings;
