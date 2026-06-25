import { useCallback, useState } from "react";
import { apiFetch, uploadImage } from "@/lib/api";
import type { Listing, ListingAuditEntry } from "@/components/admin/types";

type UseAdminListingEditorParams = {
  token: string | null;
  authHeaders: HeadersInit;
};

export const useAdminListingEditor = ({ token, authHeaders }: UseAdminListingEditorParams) => {
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [creatingListing, setCreatingListing] = useState<Listing | null>(null);
  const [listingAudit, setListingAudit] = useState<ListingAuditEntry[]>([]);
  const [listingAuditLoading, setListingAuditLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editImages, setEditImages] = useState<Array<{ id: string; url: string }>>([]);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  // Candidate images for the (not-yet-saved) new listing. The cover image is
  // kept in creatingListing.imageUrl; when there is only one candidate it is the
  // cover automatically, when there are several the admin picks the cover.
  const [createImages, setCreateImages] = useState<string[]>([]);

  const addCreateImage = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setCreateImages((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    // Auto-select as the cover when it is the first image added.
    setCreatingListing((prev) => (prev ? { ...prev, imageUrl: prev.imageUrl || trimmed } : prev));
  }, []);

  const addCreateImageUrl = useCallback(() => {
    addCreateImage(createImageUrl);
    setCreateImageUrl("");
  }, [addCreateImage, createImageUrl]);

  const removeCreateImage = useCallback((url: string) => {
    setCreateImages((prev) => {
      const next = prev.filter((item) => item !== url);
      // If the removed image was the cover, fall back to the first remaining one.
      setCreatingListing((listing) =>
        listing && listing.imageUrl === url ? { ...listing, imageUrl: next[0] ?? null } : listing
      );
      return next;
    });
  }, []);

  const resetCreateImages = useCallback(() => setCreateImages([]), []);

  const loadListingAudit = useCallback(
    async (listingId: string) => {
      setListingAuditLoading(true);
      try {
        const resp = await apiFetch(`/api/listings/${listingId}/audit`, { headers: authHeaders });
        if (resp.ok) {
          setListingAudit(await resp.json());
        } else {
          setListingAudit([]);
        }
      } catch {
        setListingAudit([]);
      } finally {
        setListingAuditLoading(false);
      }
    },
    [authHeaders]
  );

  const handleUpload = useCallback(
    async (file: File, mode: "edit" | "create" = "edit") => {
      try {
        setUploading(true);
        const result = await uploadImage(file, token);
        if (mode === "create") {
          setCreateImages((prev) => (prev.includes(result.url) ? prev : [...prev, result.url]));
          setCreatingListing((prev) => (prev ? { ...prev, imageUrl: prev.imageUrl || result.url } : prev));
          return;
        }
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
            loadListingAudit(editingListing.id);
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [authHeaders, editingListing?.id, loadListingAudit, token]
  );

  const addEditImageUrl = useCallback(async () => {
    if (!editImageUrl.trim() || !editingListing?.id) return;
    const url = editImageUrl.trim();
    const addResp = await apiFetch(`/api/listings/${editingListing.id}/images`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ url }),
    });
    if (addResp.ok) {
      const added = await addResp.json();
      setEditImages((prev) => [...prev, { id: added.id, url: added.url }]);
      loadListingAudit(editingListing.id);
    }
    setEditImageUrl("");
  }, [authHeaders, editImageUrl, editingListing?.id, loadListingAudit]);

  const openEdit = useCallback(
    async (listing: Listing) => {
      setEditingListing({ ...listing });
      setEditImages([]);
      setListingAudit([]);
      loadListingAudit(listing.id);
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
    },
    [loadListingAudit]
  );

  const removeEditImage = useCallback(
    async (image: { id: string; url: string }) => {
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
      loadListingAudit(editingListing.id);
    },
    [authHeaders, editImages, editingListing, loadListingAudit]
  );

  const reorderEditImages = useCallback(
    async (nextImages: Array<{ id: string; url: string }>) => {
      if (!editingListing) return;
      setEditImages(nextImages);
      await apiFetch(`/api/listings/${editingListing.id}/images/reorder`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ imageIds: nextImages.map((img) => img.id) }),
      });
      loadListingAudit(editingListing.id);
    },
    [authHeaders, editingListing, loadListingAudit]
  );

  return {
    addCreateImageUrl,
    addEditImageUrl,
    createImageUrl,
    createImages,
    creatingListing,
    removeCreateImage,
    resetCreateImages,
    setCreateImages,
    editImageUrl,
    editImages,
    editingListing,
    handleUpload,
    listingAudit,
    listingAuditLoading,
    loadListingAudit,
    openEdit,
    removeEditImage,
    reorderEditImages,
    setCreateImageUrl,
    setCreatingListing,
    setEditImageUrl,
    setEditImages,
    setEditingListing,
    setListingAudit,
    uploading,
  };
};
