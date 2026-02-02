import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, uploadImage, resolveImageUrl } from "@/lib/api";

type Listing = {
  id: string;
  title: string;
  priceCents: number;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "active" | "sold" | "inactive";
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  description?: string | null;
  location?: string | null;
  images?: Array<{ id: string; url: string }>;
};

const emptyListing: Listing = {
  id: "",
  title: "",
  priceCents: 0,
  listingType: "buy",
  featured: false,
  status: "active",
  year: null,
  mileage: null,
  fuel: null,
  powerHp: null,
  imageUrl: null,
  description: null,
  location: null,
};

const MyListings = () => {
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [creatingListing, setCreatingListing] = useState<Listing | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createImages, setCreateImages] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<Array<{ id: string; url: string }>>([]);
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiFetch("/api/listings/me", { headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to load listings");
      setListings(await resp.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const saveListing = async (listing: Listing) => {
    const resp = await apiFetch(`/api/listings/${listing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(listing),
    });
    if (!resp.ok) throw new Error("Failed to update listing");
    setEditingListing(null);
    fetchListings();
  };

  const createListing = async (listing: Listing) => {
    const payload = { ...listing };
    delete (payload as Partial<Listing>).id;
    if (!payload.imageUrl && createImages.length > 0) {
      payload.imageUrl = createImages[0];
    }
    const resp = await apiFetch("/api/listings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Failed to create listing");
    const created = await resp.json();

    const extraImages = createImages.filter((url) => url !== payload.imageUrl);
    for (const url of extraImages) {
      await apiFetch(`/api/listings/${created.id}/images`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ url }),
      });
    }

    setCreatingListing(null);
    setCreateImages([]);
    fetchListings();
  };

  const handleUpload = async (file: File, mode: "create" | "edit") => {
    try {
      setUploading(true);
      const result = await uploadImage(file, token);
      if (mode === "create") {
        setCreatingListing((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
        setCreateImages((prev) => [...prev, result.url]);
      } else {
        setEditingListing((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
        if (editingListing?.id) {
          const addResp = await apiFetch(`/api/listings/${editingListing.id}/images`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ url: result.url }),
          });
          if (addResp.ok) {
            const added = await addResp.json();
            setEditImages((prev) => [...prev, { id: added.id, url: added.url }]);
          }
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const openEdit = async (listing: Listing) => {
    setEditingListing({ ...listing });
    setEditImages([]);
    try {
      const resp = await apiFetch(`/api/listings/${listing.id}`);
      if (resp.ok) {
        const data = (await resp.json()) as Listing;
        const images = data.images?.map((img) => ({ id: img.id, url: img.url })) ?? [];
        setEditImages(images);
        setEditingListing((prev) => (prev ? { ...prev, ...data } : prev));
      }
    } catch {
      // ignore
    }
  };

  const removeEditImage = async (image: { id: string; url: string }) => {
    if (!editingListing) return;
    await apiFetch(`/api/listings/${editingListing.id}/images/${image.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    setEditImages((prev) => prev.filter((item) => item.url !== image.url));
    if (editingListing.imageUrl === image.url) {
      const nextUrl = editImages.find((item) => item.url !== image.url)?.url || null;
      setEditingListing({ ...editingListing, imageUrl: nextUrl });
    }
  };

  const reorderEditImages = async (nextImages: Array<{ id: string; url: string }>) => {
    if (!editingListing) return;
    setEditImages(nextImages);
    await apiFetch(`/api/listings/${editingListing.id}/images/reorder`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ imageIds: nextImages.map((img) => img.id) }),
    });
  };

  const deleteListing = async (id: string) => {
    const resp = await apiFetch(`/api/listings/${id}`, { method: "DELETE", headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to delete listing");
    fetchListings();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-wider">My Listings</h1>
              <p className="text-muted-foreground mt-1">
                Create, edit, and delete your car listings.
              </p>
            </div>
            <Dialog>
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
                        onChange={(e) =>
                          setCreatingListing({ ...creatingListing, title: e.target.value })
                        }
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
                        <option value="sold">Sold</option>
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
                      <Label>Mileage (mi)</Label>
                      <Input
                        type="number"
                        value={creatingListing.mileage ?? ""}
                        onChange={(e) =>
                          setCreatingListing({
                            ...creatingListing,
                            mileage: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Fuel</Label>
                      <Input
                        value={creatingListing.fuel ?? ""}
                        onChange={(e) =>
                          setCreatingListing({
                            ...creatingListing,
                            fuel: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Power (HP)</Label>
                      <Input
                        type="number"
                        value={creatingListing.powerHp ?? ""}
                        onChange={(e) =>
                          setCreatingListing({
                            ...creatingListing,
                            powerHp: e.target.value ? Number(e.target.value) : null,
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
                      <Input
                        value={creatingListing.description ?? ""}
                        onChange={(e) =>
                          setCreatingListing({
                            ...creatingListing,
                            description: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Featured</Label>
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={creatingListing.featured ? "yes" : "no"}
                        onChange={(e) =>
                          setCreatingListing({
                            ...creatingListing,
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
                        value={creatingListing.imageUrl ?? ""}
                        onChange={(e) =>
                          setCreatingListing({ ...creatingListing, imageUrl: e.target.value })
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
                            setCreateImages((prev) => [...prev, createImageUrl.trim()]);
                            setCreateImageUrl("");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                    {createImages.length > 0 && (
                      <div className="grid gap-2">
                        <Label>Images</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {createImages.map((url) => (
                            <div key={url} className="relative">
                              <img
                                src={resolveImageUrl(url)}
                                alt="Listing"
                                className="h-20 w-full rounded-md object-cover border border-border"
                              />
                              <button
                                type="button"
                                className="absolute top-1 right-1 rounded-full bg-background/80 px-2 text-xs"
                                onClick={() =>
                                  setCreateImages((prev) => prev.filter((item) => item !== url))
                                }
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {creatingListing.imageUrl && (
                      <div className="grid gap-2">
                        <Label>Preview</Label>
                        <img
                          src={resolveImageUrl(creatingListing.imageUrl)}
                          alt="Listing preview"
                          className="w-full h-40 object-cover rounded-md border border-border"
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
                            await handleUpload(file, "create");
                          }
                        }}
                        disabled={uploading}
                      />
                      {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="hero"
                    onClick={async () => {
                      if (creatingListing) await createListing(creatingListing);
                    }}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading listings...</p>}
            {!loading && error && <p className="text-destructive">{error}</p>}

            {!loading && !error && (
              <div className="rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
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
                        <TableCell className="capitalize">{listing.status}</TableCell>
                        <TableCell>{(listing.priceCents / 100).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
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
                                    <div className="grid gap-2">
                                      <Label>Title</Label>
                                      <Input
                                        value={editingListing.title}
                                        onChange={(e) =>
                                          setEditingListing({
                                            ...editingListing,
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <Label>Price (cents)</Label>
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
                                        <option value="active">Active</option>
                                        <option value="sold">Sold</option>
                                        <option value="inactive">Inactive</option>
                                      </select>
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
                                      <Input
                                        value={editingListing.description ?? ""}
                                        onChange={(e) =>
                                          setEditingListing({
                                            ...editingListing,
                                            description: e.target.value || null,
                                          })
                                        }
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
                                          onClick={async () => {
                                            if (!editImageUrl.trim() || !editingListing.id) return;
                                            const url = editImageUrl.trim();
                                            const addResp = await apiFetch(`/api/listings/${editingListing.id}/images`, {
                                              method: "POST",
                                              headers: authHeaders,
                                              body: JSON.stringify({ url }),
                                            });
                                            if (addResp.ok) {
                                              const added = await addResp.json();
                                              setEditImages((prev) => [...prev, { id: added.id, url: added.url }]);
                                            }
                                            setEditImageUrl("");
                                          }}
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
                                                className="h-20 w-full rounded-md object-cover border border-border"
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
                                    {editingListing.imageUrl && (
                                      <div className="grid gap-2">
                                        <Label>Preview</Label>
                                        <img
                                          src={resolveImageUrl(editingListing.imageUrl)}
                                          alt="Listing preview"
                                          className="w-full h-40 object-cover rounded-md border border-border"
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
                                            await handleUpload(file, "edit");
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
                                      if (editingListing) await saveListing(editingListing);
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
                              onClick={async () => {
                                await deleteListing(listing.id);
                              }}
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
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyListings;
