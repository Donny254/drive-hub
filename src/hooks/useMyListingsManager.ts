import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, uploadImage } from "@/lib/api";

export type Listing = {
  id: string;
  title: string;
  priceCents: number;
  listingType: "buy" | "rent" | "sell";
  featured: boolean;
  status: "pending_approval" | "active" | "sold" | "inactive" | "rejected";
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  powerHp: number | null;
  imageUrl: string | null;
  description?: string | null;
  location?: string | null;
  moderationNotes?: string | null;
  riskFlags?: string[];
  riskScore?: number;
  approvedAt?: string | null;
  images?: Array<{ id: string; url: string }>;
};

export type SellerAnalytics = {
  summary: {
    totalListings: number;
    activeListings: number;
    pendingListings: number;
    rejectedListings: number;
    soldListings: number;
    totalViews: number;
    totalInquiries: number;
    totalBookings: number;
    confirmedBookings: number;
    viewToInquiryRate: number;
    inquiryToBookingRate: number;
    inquiryToConfirmedRate: number;
    averageRiskScore: number;
  };
  topListings: Array<{
    id: string;
    title: string;
    status: Listing["status"];
    priceCents: number;
    viewsCount: number;
    inquiriesCount: number;
    bookingsCount: number;
  }>;
};

export const emptyListing: Listing = {
  id: "",
  title: "",
  priceCents: 0,
  listingType: "buy",
  featured: false,
  status: "pending_approval",
  year: null,
  mileage: null,
  fuel: null,
  powerHp: null,
  imageUrl: null,
  description: null,
  location: null,
};

const currentYear = new Date().getFullYear();
export const vehicleYears = Array.from(
  { length: currentYear - 1949 },
  (_, index) => String(currentYear + 1 - index)
);

const MIN_IMAGE_WIDTH = 640;
const MIN_IMAGE_HEIGHT = 480;

const validateListingDraft = (listing: Listing, imageUrls: string[] = []) => {
  if (!listing.title || !listing.title.trim()) return "Title is required";
  if (!Number.isInteger(listing.priceCents) || listing.priceCents <= 0) {
    return "Price must be greater than zero";
  }
  if (!Number.isInteger(listing.year) || listing.year < 1950 || listing.year > new Date().getFullYear() + 1) {
    return "Year must be valid";
  }
  if (!listing.location || listing.location.trim().length < 2) return "Location is required";
  if (!listing.description || !listing.description.trim()) return "Description is required";
  const primaryImage = listing.imageUrl || imageUrls[0] || null;
  if (!primaryImage) return "A primary image is required";
  return null;
};

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image dimensions"));
    };

    image.src = objectUrl;
  });

type UseMyListingsManagerParams = {
  token: string | null;
};

export const useMyListingsManager = ({ token }: UseMyListingsManagerParams) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [creatingListing, setCreatingListing] = useState<Listing | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createImages, setCreateImages] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<Array<{ id: string; url: string }>>([]);
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [listingsResp, analyticsResp] = await Promise.all([
        apiFetch("/api/listings/me", { headers: authHeaders }),
        apiFetch("/api/listings/analytics/me", { headers: authHeaders }),
      ]);
      if (!listingsResp.ok) throw new Error("Failed to load listings");
      if (!analyticsResp.ok) throw new Error("Failed to load analytics");
      setListings(await listingsResp.json());
      setAnalytics(await analyticsResp.json());
    } catch (err) {
      console.error(err);
      setError("Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const saveListing = useCallback(
    async (listing: Listing) => {
      setFormError(null);
      if (uploading) {
        const message = "Please wait for the image upload to finish";
        setFormError(message);
        throw new Error(message);
      }
      const validationError = validateListingDraft(listing, editImages.map((image) => image.url));
      if (validationError) {
        setFormError(validationError);
        throw new Error(validationError);
      }
      const resp = await apiFetch(`/api/listings/${listing.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(listing),
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const message = errorData.error || "Failed to update listing";
        setFormError(message);
        throw new Error(message);
      }
      setEditingListing(null);
      await fetchListings();
    },
    [authHeaders, editImages, fetchListings, uploading]
  );

  const createListing = useCallback(
    async (listing: Listing) => {
      setFormError(null);
      if (uploading) {
        const message = "Please wait for the image upload to finish";
        setFormError(message);
        throw new Error(message);
      }
      const payload = { ...listing };
      delete (payload as Partial<Listing>).id;
      if (!payload.imageUrl && createImages.length > 0) {
        payload.imageUrl = createImages[0];
      }
      const validationError = validateListingDraft({ ...listing, imageUrl: payload.imageUrl }, createImages);
      if (validationError) {
        setFormError(validationError);
        throw new Error(validationError);
      }
      (payload as typeof payload & { imageUrls?: string[] }).imageUrls = createImages;
      const resp = await apiFetch("/api/listings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const message = errorData.error || "Failed to create listing";
        setFormError(message);
        throw new Error(message);
      }

      setCreatingListing(null);
      setCreateImages([]);
      await fetchListings();
    },
    [authHeaders, createImages, fetchListings, uploading]
  );

  const handleUpload = useCallback(
    async (file: File, mode: "create" | "edit") => {
      try {
        setUploading(true);
        setFormError(null);
        const { width, height } = await readImageDimensions(file);
        if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
          throw new Error(`Image too small. Minimum size is ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px`);
        }
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
        setFormError(null);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setFormError(message);
        return false;
      } finally {
        setUploading(false);
      }
    },
    [authHeaders, editingListing?.id, token]
  );

  const openEdit = useCallback(
    async (listing: Listing) => {
      setFormError(null);
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
    },
    []
  );

  const addCreateImageUrl = useCallback(() => {
    if (!createImageUrl.trim()) return;
    const nextUrl = createImageUrl.trim();
    setCreateImages((prev) => [...prev, nextUrl]);
    setCreatingListing((prev) =>
      prev
        ? {
            ...prev,
            imageUrl: prev.imageUrl || nextUrl,
          }
        : prev
    );
    setCreateImageUrl("");
  }, [createImageUrl]);

  const removeCreateImage = useCallback((url: string) => {
    setCreateImages((prev) => {
      const nextImages = prev.filter((item) => item !== url);
      setCreatingListing((current) =>
        current
          ? {
              ...current,
              imageUrl: current.imageUrl === url ? nextImages[0] || null : current.imageUrl,
            }
          : current
      );
      return nextImages;
    });
  }, []);

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
      setEditingListing((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: prev.imageUrl || added.url,
            }
          : prev
      );
    }
    setEditImageUrl("");
  }, [authHeaders, editImageUrl, editingListing?.id]);

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
    },
    [authHeaders, editImages, editingListing]
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
    },
    [authHeaders, editingListing]
  );

  const deleteListing = useCallback(
    async (id: string) => {
      const resp = await apiFetch(`/api/listings/${id}`, { method: "DELETE", headers: authHeaders });
      if (!resp.ok) throw new Error("Failed to delete listing");
      await fetchListings();
    },
    [authHeaders, fetchListings]
  );

  const imageError = formError && /(image|upload|file)/i.test(formError) ? formError : null;

  return {
    addCreateImageUrl,
    addEditImageUrl,
    analytics,
    authHeaders,
    createImageUrl,
    createImages,
    createListing,
    creatingListing,
    deleteListing,
    editImageUrl,
    editImages,
    editingListing,
    error,
    fetchListings,
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
  };
};
