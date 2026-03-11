import type { Dispatch, SetStateAction } from "react";
import AdminBulkActionBar from "@/components/admin/AdminBulkActionBar";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminTablePagination from "@/components/admin/AdminTablePagination";
import type { DeleteTarget, Listing, ListingAuditEntry } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { resolveImageUrl } from "@/lib/api";


type AdminListingsTabProps = {
  listings: Listing[];
  flaggedMediaListings: Listing[];
  listingsNeedingReview: Listing[];
  creatingListing: Listing | null;
  setCreatingListing: Dispatch<SetStateAction<Listing | null>>;
  editingListing: Listing | null;
  setEditingListing: Dispatch<SetStateAction<Listing | null>>;
  createImageUrl: string;
  setCreateImageUrl: Dispatch<SetStateAction<string>>;
  editImageUrl: string;
  setEditImageUrl: Dispatch<SetStateAction<string>>;
  editImages: Array<{ id: string; url: string }>;
  listingAudit: ListingAuditEntry[];
  listingAuditLoading: boolean;
  selectedListingIds: string[];
  setSelectedListingIds: Dispatch<SetStateAction<string[]>>;
  confirmBulkDeleteListingsOpen: boolean;
  setConfirmBulkDeleteListingsOpen: Dispatch<SetStateAction<boolean>>;
  listingStatusFilter: Listing["status"] | "all";
  setListingStatusFilter: Dispatch<SetStateAction<Listing["status"] | "all">>;
  filteredListings: Listing[];
  paginatedListings: Listing[];
  listingsPage: number;
  listingsPageCount: number;
  setListingsPage: Dispatch<SetStateAction<number>>;
  uploading: boolean;
  emptyListing: Listing;
  openEdit: (listing: Listing) => Promise<void> | void;
  approveListing: (listing: Listing) => Promise<void> | void;
  bulkApproveListings: () => Promise<void> | void;
  bulkDeleteListings: () => Promise<void> | void;
  createListing: () => Promise<void> | void;
  saveListing: () => Promise<void> | void;
  handleUpload: (file: File, mode?: "edit" | "create") => Promise<void> | void;
  loadListingAudit: (listingId: string) => Promise<void> | void;
  removeEditImage: (image: { id: string; url: string }) => Promise<void> | void;
  reorderEditImages: (nextImages: Array<{ id: string; url: string }>) => Promise<void> | void;
  toggleSelection: (id: string, selected: string[], setSelected: (ids: string[]) => void) => void;
  formatMoney: (cents?: number | null) => string;
  formatDate: (value?: string | null) => string;
  formatDateTime: (value?: string | null) => string;
  statusVariant: (status?: string | null) => string;
  setDeleteTarget: Dispatch<SetStateAction<DeleteTarget>>;
  addEditImageUrl: () => Promise<void> | void;
};

const AdminListingsTab = ({
  listings,
  flaggedMediaListings,
  listingsNeedingReview,
  creatingListing,
  setCreatingListing,
  editingListing,
  setEditingListing,
  createImageUrl,
  setCreateImageUrl,
  editImageUrl,
  setEditImageUrl,
  editImages,
  listingAudit,
  listingAuditLoading,
  selectedListingIds,
  setSelectedListingIds,
  confirmBulkDeleteListingsOpen,
  setConfirmBulkDeleteListingsOpen,
  listingStatusFilter,
  setListingStatusFilter,
  filteredListings,
  paginatedListings,
  listingsPage,
  listingsPageCount,
  setListingsPage,
  uploading,
  emptyListing,
  openEdit,
  approveListing,
  bulkApproveListings,
  bulkDeleteListings,
  createListing,
  saveListing,
  handleUpload,
  loadListingAudit,
  removeEditImage,
  reorderEditImages,
  toggleSelection,
  formatMoney,
  formatDate,
  formatDateTime,
  statusVariant,
  setDeleteTarget,
  addEditImageUrl,
}: AdminListingsTabProps) => (
<TabsContent value="listings" className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Inventory</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{listings.length}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Total managed listings</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pending Approval</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">
                          {listings.filter((listing) => listing.status === "pending_approval").length}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">Waiting for admin decision</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Rejected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">
                          {listings.filter((listing) => listing.status === "rejected").length}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">Need seller follow-up</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Flagged</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-semibold">{flaggedMediaListings.length}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Risk or media review needed</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1fr,1.7fr]">
                    <Card className="rounded-2xl">
                      <CardHeader className="border-b border-border pb-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">Moderation Queue</CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Review risky, rejected, and pending submissions first.
                            </p>
                          </div>
                          <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                            {listingsNeedingReview.length} in queue
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-6">
                        {listingsNeedingReview.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                            No listings need approval right now.
                          </div>
                        ) : (
                          listingsNeedingReview.slice(0, 5).map((listing) => (
                            <div
                              key={listing.id}
                              className="rounded-2xl border border-border bg-background/60 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{listing.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                                    {listing.listingType} • {listing.location || "No location"}
                                  </p>
                                </div>
                                <Badge variant={statusVariant(listing.status)} className="capitalize">
                                  {listing.status.replaceAll("_", " ")}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm">
                                {formatMoney(listing.priceCents)}
                                <span className="text-muted-foreground"> • Risk {listing.riskScore ?? 0}/100</span>
                              </p>
                              {listing.riskFlags?.length ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {listing.riskFlags.join(", ")}
                                </p>
                              ) : null}
                              {listing.moderationNotes ? (
                                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                  {listing.moderationNotes}
                                </p>
                              ) : null}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button variant="secondary" size="sm" onClick={() => openEdit(listing)}>
                                  Review
                                </Button>
                                <Button variant="hero" size="sm" onClick={() => approveListing(listing)}>
                                  Approve
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-4">
                          <AdminSectionHeader
                            title="Inventory Workspace"
                            description="Add listings directly and manage marketplace visibility without opening every request."
                            stats={
                              <>
                                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                  {listings.filter((listing) => listing.status === "active").length} active
                                </div>
                                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                                  {listings.filter((listing) => listing.status === "sold").length} sold
                                </div>
                              </>
                            }
                            actions={
                              <Dialog
                                open={Boolean(creatingListing)}
                                onOpenChange={(open) => {
                                  if (!open) {
                                    setCreatingListing(null);
                                    setCreateImageUrl("");
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="hero" onClick={() => setCreatingListing({ ...emptyListing })}>
                                    New Listing
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[85vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Create Listing</DialogTitle>
                                  </DialogHeader>
                                  {creatingListing && (
                                    <div className="grid gap-4">
                                      <div className="grid gap-2">
                                        <Label>Title</Label>
                                        <Input
                                          value={creatingListing.title}
                                          onChange={(e) => setCreatingListing({ ...creatingListing, title: e.target.value })}
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Price (KES)</Label>
                                        <Input
                                          type="number"
                                          value={creatingListing.priceCents / 100}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              priceCents: Math.round(Number(e.target.value || 0) * 100),
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Type</Label>
                                        <select
                                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                          value={creatingListing.listingType}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              listingType: e.target.value as Listing["listingType"],
                                            })
                                          }
                                        >
                                          <option value="buy">Buy</option>
                                          <option value="rent">Rent</option>
                                          <option value="sell">Sell</option>
                                        </select>
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Status</Label>
                                        <select
                                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                          value={creatingListing.status}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              status: e.target.value as Listing["status"],
                                            })
                                          }
                                        >
                                          <option value="active">Active</option>
                                          <option value="pending_approval">Pending Approval</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Year</Label>
                                        <Input
                                          type="number"
                                          value={creatingListing.year ?? ""}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              year: e.target.value ? Number(e.target.value) : null,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Location</Label>
                                        <Input
                                          value={creatingListing.location ?? ""}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              location: e.target.value || null,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Description</Label>
                                        <Textarea
                                          value={creatingListing.description ?? ""}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              description: e.target.value || null,
                                            })
                                          }
                                          rows={5}
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Image URL</Label>
                                        <Input
                                          value={creatingListing.imageUrl ?? ""}
                                          onChange={(e) =>
                                            setCreatingListing({
                                              ...creatingListing,
                                              imageUrl: e.target.value || null,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Add Image URL</Label>
                                        <div className="flex gap-2">
                                          <Input
                                            value={createImageUrl}
                                            onChange={(e) => setCreateImageUrl(e.target.value)}
                                          />
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => {
                                              if (!createImageUrl.trim()) return;
                                              setCreatingListing({
                                                ...creatingListing,
                                                imageUrl: creatingListing.imageUrl || createImageUrl.trim(),
                                              });
                                              setCreateImageUrl("");
                                            }}
                                          >
                                            Use
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid gap-2">
                                        <Label>Upload Image</Label>
                                        <Input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUpload(file, "create");
                                          }}
                                          disabled={uploading}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <DialogFooter>
                                    <Button variant="hero" onClick={createListing} disabled={uploading}>
                                      {uploading ? "Uploading..." : "Create"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            }
                            controls={
                              <>
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={listingStatusFilter}
                                  onChange={(e) =>
                                    setListingStatusFilter(e.target.value as Listing["status"] | "all")
                                  }
                                >
                                  <option value="all">All statuses</option>
                                  <option value="pending_approval">Pending approval</option>
                                  <option value="active">Active</option>
                                  <option value="sold">Sold</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                <p className="text-sm text-muted-foreground">
                                  Showing {paginatedListings.length} of {filteredListings.length} listings
                                </p>
                              </>
                            }
                          />
                          <AdminBulkActionBar count={selectedListingIds.length}>
                            <Button variant="hero" size="sm" onClick={bulkApproveListings}>
                              Approve Selected
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setConfirmBulkDeleteListingsOpen(true)}
                            >
                              Delete Selected
                            </Button>
                          </AdminBulkActionBar>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="rounded-xl border border-border">
                            <Table>
                              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                                <TableRow>
                                  <TableHead className="w-10">
                                    <input
                                      type="checkbox"
                                      checked={
                                        paginatedListings.length > 0 &&
                                        paginatedListings.every((listing) => selectedListingIds.includes(listing.id))
                                      }
                                      onChange={(e) =>
                                        setSelectedListingIds(
                                          e.target.checked
                                            ? Array.from(
                                                new Set([
                                                  ...selectedListingIds,
                                                  ...paginatedListings.map((listing) => listing.id),
                                                ])
                                              )
                                            : selectedListingIds.filter(
                                                (id) => !paginatedListings.some((listing) => listing.id === id)
                                              )
                                        )
                                      }
                                    />
                                  </TableHead>
                                  <TableHead>Listing</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Risk</TableHead>
                                  <TableHead>Price</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paginatedListings.map((listing) => (
                                  <TableRow key={listing.id}>
                                    <TableCell>
                                      <input
                                        type="checkbox"
                                        checked={selectedListingIds.includes(listing.id)}
                                        onChange={() =>
                                          toggleSelection(listing.id, selectedListingIds, setSelectedListingIds)
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        {listing.imageUrl ? (
                                          <img
                                            src={resolveImageUrl(listing.imageUrl)}
                                            alt={listing.title}
                                            className="h-12 w-16 rounded-md border border-border object-cover"
                                          />
                                        ) : (
                                          <div className="h-12 w-16 rounded-md border border-dashed border-border bg-secondary/40" />
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-medium">{listing.title}</p>
                                          <p className="mt-1 text-xs text-muted-foreground capitalize">
                                            {listing.listingType} • {listing.location || "No location"}
                                          </p>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={statusVariant(listing.status)} className="capitalize">
                                        {listing.status.replaceAll("_", " ")}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        <span className="font-medium">{listing.riskScore ?? 0}</span>
                                        <span className="text-muted-foreground"> / 100</span>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {listing.riskFlags?.length ? listing.riskFlags.join(", ") : "No flags"}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        <p>{formatMoney(listing.priceCents)}</p>
                                        {listing.approvedAt ? (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            Approved {formatDate(listing.approvedAt)}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        {(listing.status === "pending_approval" || listing.status === "rejected") && (
                                          <Button variant="hero" size="sm" onClick={() => approveListing(listing)}>
                                            Approve
                                          </Button>
                                        )}
                                        <Dialog
                                          open={editingListing?.id === listing.id}
                                          onOpenChange={(open) => {
                                            if (!open) {
                                              setEditingListing(null);
                                              setEditImages([]);
                                              setEditImageUrl("");
                                              setListingAudit([]);
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
                                          <DialogContent className="max-h-[85vh] overflow-y-auto">
                                            <DialogHeader>
                                              <DialogTitle>Edit Listing</DialogTitle>
                                            </DialogHeader>
                                            {editingListing && (
                                              <div className="grid gap-4">
                                                <div className="rounded-lg border border-border bg-card/60 p-4 text-sm">
                                                  <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">Review state</span>
                                                    <Badge
                                                      variant={statusVariant(editingListing.status)}
                                                      className="capitalize"
                                                    >
                                                      {editingListing.status.replaceAll("_", " ")}
                                                    </Badge>
                                                  </div>
                                                  {editingListing.approvedAt && (
                                                    <p className="mt-2 text-muted-foreground">
                                                      Last approved on {formatDate(editingListing.approvedAt)}
                                                    </p>
                                                  )}
                                                  <p className="mt-2 text-muted-foreground">
                                                    Risk score: {editingListing.riskScore ?? 0}/100
                                                  </p>
                                                  <p className="mt-1 text-muted-foreground">
                                                    Flags: {editingListing.riskFlags?.length ? editingListing.riskFlags.join(", ") : "none"}
                                                  </p>
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Title</Label>
                                                  <Input
                                                    value={editingListing.title}
                                                    onChange={(e) =>
                                                      setEditingListing({ ...editingListing, title: e.target.value })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Price (KES)</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingListing.priceCents / 100}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        priceCents: Math.round(Number(e.target.value || 0) * 100),
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Type</Label>
                                                  <select
                                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                                    value={editingListing.listingType}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        listingType: e.target.value as Listing["listingType"],
                                                      })
                                                    }
                                                  >
                                                    <option value="buy">Buy</option>
                                                    <option value="rent">Rent</option>
                                                    <option value="sell">Sell</option>
                                                  </select>
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Status</Label>
                                                  <select
                                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                                    value={editingListing.status}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        status: e.target.value as Listing["status"],
                                                      })
                                                    }
                                                  >
                                                    <option value="pending_approval">Pending Approval</option>
                                                    <option value="active">Active</option>
                                                    <option value="sold">Sold</option>
                                                    <option value="inactive">Inactive</option>
                                                    <option value="rejected">Rejected</option>
                                                  </select>
                                                </div>
                                                {(editingListing.status === "pending_approval" || editingListing.status === "rejected") && (
                                                  <div className="rounded-md border border-border bg-background/60 p-3">
                                                    <Button
                                                      type="button"
                                                      variant="hero"
                                                      size="sm"
                                                      onClick={() => approveListing(editingListing)}
                                                    >
                                                      Approve Listing
                                                    </Button>
                                                  </div>
                                                )}
                                                <div className="grid gap-2">
                                                  <Label>Moderation Notes</Label>
                                                  <Textarea
                                                    value={editingListing.moderationNotes ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        moderationNotes: e.target.value || null,
                                                      })
                                                    }
                                                    placeholder="Explain why a listing was rejected, what must be fixed, or why it was approved."
                                                    rows={4}
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Year</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingListing.year ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        year: e.target.value ? Number(e.target.value) : null,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Mileage (mi)</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingListing.mileage ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        mileage: e.target.value ? Number(e.target.value) : null,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Fuel</Label>
                                                  <Input
                                                    value={editingListing.fuel ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        fuel: e.target.value || null,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Power (HP)</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingListing.powerHp ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        powerHp: e.target.value ? Number(e.target.value) : null,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Location</Label>
                                                  <Input
                                                    value={editingListing.location ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        location: e.target.value || null,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Description</Label>
                                                  <Textarea
                                                    value={editingListing.description ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        description: e.target.value || null,
                                                      })
                                                    }
                                                    rows={5}
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Featured</Label>
                                                  <select
                                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                                    value={editingListing.featured ? "yes" : "no"}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        featured: e.target.value === "yes",
                                                      })
                                                    }
                                                  >
                                                    <option value="no">No</option>
                                                    <option value="yes">Yes</option>
                                                  </select>
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Image URL</Label>
                                                  <Input
                                                    value={editingListing.imageUrl ?? ""}
                                                    onChange={(e) =>
                                                      setEditingListing({
                                                        ...editingListing,
                                                        imageUrl: e.target.value,
                                                      })
                                                    }
                                                  />
                                                </div>
                                                <div className="grid gap-2">
                                                  <Label>Add Image URL</Label>
                                                  <div className="flex gap-2">
                                                    <Input
                                                      value={editImageUrl}
                                                      onChange={(e) => setEditImageUrl(e.target.value)}
                                                    />
                                                    <Button
                                                      type="button"
                                                      variant="secondary"
                                                      onClick={addEditImageUrl}
                                                    >
                                                      Add
                                                    </Button>
                                                  </div>
                                                </div>
                                                {editImages.length > 0 && (
                                                  <div className="grid gap-2">
                                                    <Label>Images</Label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                      {editImages.map((img, index) => (
                                                        <div key={img.id ?? img.url} className="relative">
                                                          <img
                                                            src={resolveImageUrl(img.url)}
                                                            alt="Listing"
                                                            className="h-20 w-full rounded-md border border-border object-cover"
                                                          />
                                                          <button
                                                            type="button"
                                                            className="absolute top-1 left-1 rounded-full bg-background/80 px-2 text-xs"
                                                            draggable
                                                            onDragStart={(e) => {
                                                              e.dataTransfer.setData("text/plain", String(index));
                                                            }}
                                                            onDragOver={(e) => e.preventDefault()}
                                                            onDrop={(e) => {
                                                              e.preventDefault();
                                                              const from = Number(e.dataTransfer.getData("text/plain"));
                                                              if (Number.isNaN(from) || from === index) return;
                                                              const next = [...editImages];
                                                              const [moved] = next.splice(from, 1);
                                                              next.splice(index, 0, moved);
                                                              reorderEditImages(next);
                                                            }}
                                                          >
                                                            ↕
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className="absolute top-1 right-1 rounded-full bg-background/80 px-2 text-xs"
                                                            onClick={() => removeEditImage(img)}
                                                          >
                                                            ✕
                                                          </button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                                <div className="grid gap-2">
                                                  <Label>Audit History</Label>
                                                  <div className="rounded-lg border border-border bg-card/50 p-3">
                                                    {listingAuditLoading ? (
                                                      <p className="text-sm text-muted-foreground">Loading audit history...</p>
                                                    ) : listingAudit.length === 0 ? (
                                                      <p className="text-sm text-muted-foreground">No audit history yet.</p>
                                                    ) : (
                                                      <div className="space-y-3">
                                                        {listingAudit.map((entry) => (
                                                          <div
                                                            key={entry.id}
                                                            className="rounded-md border border-border/70 bg-background/60 p-3 text-sm"
                                                          >
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                              <div>
                                                                <p className="font-medium capitalize">
                                                                  {entry.action.replaceAll("_", " ")}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                  {formatDateTime(entry.createdAt)}
                                                                </p>
                                                              </div>
                                                              <p className="text-xs text-muted-foreground">
                                                                {entry.actor?.name || entry.actor?.email || "System"}
                                                              </p>
                                                            </div>
                                                            {entry.details.changedFields?.length ? (
                                                              <p className="mt-2 text-xs text-muted-foreground">
                                                                Changed: {entry.details.changedFields.join(", ")}
                                                              </p>
                                                            ) : null}
                                                            {entry.details.previousStatus || entry.details.nextStatus ? (
                                                              <p className="mt-1 text-xs text-muted-foreground">
                                                                Status: {entry.details.previousStatus || "--"} to{" "}
                                                                {entry.details.nextStatus || "--"}
                                                              </p>
                                                            ) : null}
                                                            {entry.details.riskScore !== undefined ? (
                                                              <p className="mt-1 text-xs text-muted-foreground">
                                                                Risk score: {entry.details.riskScore}/100
                                                              </p>
                                                            ) : null}
                                                            {entry.details.riskFlags?.length ? (
                                                              <p className="mt-1 text-xs text-muted-foreground">
                                                                Flags: {entry.details.riskFlags.join(", ")}
                                                              </p>
                                                            ) : null}
                                                            {entry.details.moderationNotes ? (
                                                              <p className="mt-1 text-xs text-muted-foreground">
                                                                Notes: {entry.details.moderationNotes}
                                                              </p>
                                                            ) : null}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                {editingListing.imageUrl && (
                                                  <div className="grid gap-2">
                                                    <Label>Preview</Label>
                                                    <img
                                                      src={resolveImageUrl(editingListing.imageUrl)}
                                                      alt="Listing preview"
                                                      className="h-40 w-full rounded-md border border-border object-cover"
                                                    />
                                                  </div>
                                                )}
                                                <div className="grid gap-2">
                                                  <Label>Upload Image</Label>
                                                  <Input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={async (e) => {
                                                      const files = e.target.files ? Array.from(e.target.files) : [];
                                                      for (const file of files) {
                                                        await handleUpload(file);
                                                      }
                                                    }}
                                                    disabled={uploading}
                                                  />
                                                  {uploading && (
                                                    <p className="text-sm text-muted-foreground">Uploading...</p>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                            <DialogFooter>
                                              <Button
                                                variant="hero"
                                                onClick={async () => {
                                                  await saveListing();
                                                }}
                                              >
                                                Save
                                              </Button>
                                            </DialogFooter>
                                          </DialogContent>
                                        </Dialog>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() =>
                                            setDeleteTarget({
                                              kind: "listing",
                                              id: listing.id,
                                              label: listing.title,
                                            })
                                          }
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
                          <AdminTablePagination
                            page={listingsPage}
                            pageCount={listingsPageCount}
                            onPrevious={() => setListingsPage((page) => Math.max(1, page - 1))}
                            onNext={() => setListingsPage((page) => Math.min(listingsPageCount, page + 1))}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  <AlertDialog
                    open={confirmBulkDeleteListingsOpen}
                    onOpenChange={setConfirmBulkDeleteListingsOpen}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete selected listings?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove {selectedListingIds.length} selected listings from the marketplace.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={bulkDeleteListings}
                        >
                          Delete Listings
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>
);

export default AdminListingsTab;
