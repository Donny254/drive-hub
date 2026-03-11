import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveImageUrl } from "@/lib/api";
import type { Listing } from "@/hooks/useMyListingsManager";

type SellerListingDialogProps = {
  title: string;
  listing: Listing;
  setListing: Dispatch<SetStateAction<Listing | null>>;
  formError: string | null;
  imageError: string | null;
  vehicleYears: string[];
  statusNote: string;
  reviewNote?: string | null;
  imageUrlValue: string;
  setImageUrlValue: (value: string) => void;
  addImageUrl: () => void | Promise<void>;
  images: Array<string | { id?: string; url: string }>;
  removeImage: (image: string | { id?: string; url: string }) => void | Promise<void>;
  reorderImages?: (nextImages: Array<{ id: string; url: string }>) => void | Promise<void>;
  uploading: boolean;
  onUploadFiles: (files: File[]) => Promise<void>;
  onSubmit: () => Promise<void>;
  submitLabel: string;
};

const SellerListingDialog = ({
  title,
  listing,
  setListing,
  formError,
  imageError,
  vehicleYears,
  statusNote,
  reviewNote,
  imageUrlValue,
  setImageUrlValue,
  addImageUrl,
  images,
  removeImage,
  reorderImages,
  uploading,
  onUploadFiles,
  onSubmit,
  submitLabel,
}: SellerListingDialogProps) => {
  const normalizedImages = images.map((image) =>
    typeof image === "string" ? { id: image, url: image } : { id: image.id ?? image.url, url: image.url }
  );

  return (
    <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
      <DialogHeader>
        <div className="border-b border-border px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
        </div>
      </DialogHeader>
      <div className="grid gap-4 overflow-y-auto px-6 py-4">
        <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
          {statusNote}
        </div>
        {reviewNote ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 text-sm">
            <p className="text-muted-foreground">{reviewNote}</p>
          </div>
        ) : null}
        {formError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label>Title</Label>
          <Input value={listing.title} onChange={(e) => setListing((prev) => (prev ? { ...prev, title: e.target.value } : prev))} />
        </div>
        <div className="grid gap-2">
          <Label>Price (KES)</Label>
          <Input
            type="number"
            value={listing.priceCents / 100}
            onChange={(e) =>
              setListing((prev) =>
                prev ? { ...prev, priceCents: Math.round(Number(e.target.value || 0) * 100) } : prev
              )
            }
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={listing.listingType}
            onChange={(e) =>
              setListing((prev) => (prev ? { ...prev, listingType: e.target.value as Listing["listingType"] } : prev))
            }
          >
            <option value="buy">Buy</option>
            <option value="rent">Rent</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Submission status</span>
            <span className="font-medium capitalize">{listing.status.replaceAll("_", " ")}</span>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Year</Label>
          <Select
            value={listing.year ? String(listing.year) : ""}
            onValueChange={(value) =>
              setListing((prev) => (prev ? { ...prev, year: value ? Number(value) : null } : prev))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vehicle year" />
            </SelectTrigger>
            <SelectContent>
              {vehicleYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Mileage (mi)</Label>
          <Input
            type="number"
            value={listing.mileage ?? ""}
            onChange={(e) =>
              setListing((prev) => (prev ? { ...prev, mileage: e.target.value ? Number(e.target.value) : null } : prev))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label>Fuel</Label>
          <Input
            value={listing.fuel ?? ""}
            onChange={(e) => setListing((prev) => (prev ? { ...prev, fuel: e.target.value || null } : prev))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Power (HP)</Label>
          <Input
            type="number"
            value={listing.powerHp ?? ""}
            onChange={(e) =>
              setListing((prev) => (prev ? { ...prev, powerHp: e.target.value ? Number(e.target.value) : null } : prev))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label>Location</Label>
          <Input
            value={listing.location ?? ""}
            onChange={(e) => setListing((prev) => (prev ? { ...prev, location: e.target.value || null } : prev))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea
            value={listing.description ?? ""}
            onChange={(e) => setListing((prev) => (prev ? { ...prev, description: e.target.value || null } : prev))}
            rows={5}
          />
        </div>
        <div className="grid gap-2">
          <Label>Featured</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={listing.featured ? "yes" : "no"}
            onChange={(e) => setListing((prev) => (prev ? { ...prev, featured: e.target.value === "yes" } : prev))}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Image URL</Label>
          <Input
            value={listing.imageUrl ?? ""}
            onChange={(e) => setListing((prev) => (prev ? { ...prev, imageUrl: e.target.value } : prev))}
          />
        </div>
        <div className="grid gap-2">
          <Label>Add Image URL</Label>
          <div className="flex gap-2">
            <Input value={imageUrlValue} onChange={(e) => setImageUrlValue(e.target.value)} />
            <Button type="button" variant="secondary" onClick={addImageUrl}>
              Add
            </Button>
          </div>
        </div>
        {normalizedImages.length > 0 ? (
          <div className="grid gap-2">
            <Label>Images</Label>
            <div className="grid grid-cols-3 gap-2">
              {normalizedImages.map((image, index) => (
                <div key={image.id ?? image.url} className="relative">
                  <img
                    src={resolveImageUrl(image.url)}
                    alt="Listing"
                    className="h-20 w-full rounded-md border border-border object-cover"
                  />
                  {reorderImages ? (
                    <button
                      type="button"
                      className="absolute top-1 left-1 rounded-full bg-background/80 px-2 text-xs"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = Number(e.dataTransfer.getData("text/plain"));
                        if (Number.isNaN(from) || from === index) return;
                        const next = [...normalizedImages];
                        const [moved] = next.splice(from, 1);
                        next.splice(index, 0, moved);
                        reorderImages(next.map((item) => ({ id: item.id!, url: item.url })));
                      }}
                    >
                      ↕
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-background/80 px-2 text-xs"
                    onClick={() => removeImage(typeof images[index] === "string" ? image.url : images[index])}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Primary image status</span>
            <span className={listing.imageUrl ? "text-emerald-400" : "text-amber-400"}>
              {listing.imageUrl ? "Ready" : "Missing"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {listing.imageUrl ? "Primary image attached." : "Upload or add one image before saving changes."}
          </p>
        </div>
        {listing.imageUrl ? (
          <div className="grid gap-2">
            <Label>Preview</Label>
            <img
              src={resolveImageUrl(listing.imageUrl)}
              alt="Listing preview"
              className="h-40 w-full rounded-md border border-border object-cover"
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label>Upload Image</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              await onUploadFiles(files);
            }}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">JPEG, PNG, or WEBP only. Minimum 640x480. Max 5MB.</p>
          <p className="text-xs text-muted-foreground">WhatsApp-compressed photos are often too small for listings.</p>
          {imageError ? <p className="text-sm text-destructive">{imageError}</p> : null}
          {uploading ? <p className="text-sm text-muted-foreground">Uploading...</p> : null}
        </div>
      </div>
      <DialogFooter className="border-t border-border bg-background px-6 py-4">
        <Button variant="hero" disabled={uploading} onClick={onSubmit}>
          {uploading ? "Uploading..." : submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default SellerListingDialog;
