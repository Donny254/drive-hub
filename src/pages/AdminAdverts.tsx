import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import AdminFormDialog from "@/components/admin/AdminFormDialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl, uploadImage } from "@/lib/api";

type Advert = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean;
};

const emptyAdvert: Advert = {
  id: "",
  title: "",
  subtitle: "",
  description: "",
  ctaLabel: "View Listings",
  ctaLink: "/market",
  imageUrl: null,
  displayOrder: 0,
  active: true,
};

const AdminAdverts = () => {
  const { token } = useAuth();
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [creating, setCreating] = useState<Advert | null>(null);
  const [editing, setEditing] = useState<Advert | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchAdverts = useCallback(async () => {
    const resp = await apiFetch("/api/adverts?includeInactive=true", { headers: authHeaders });
    if (resp.ok) {
      setAdverts(await resp.json());
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchAdverts();
  }, [fetchAdverts]);

  const filtered = adverts.filter((advert) =>
    `${advert.title} ${advert.subtitle ?? ""} ${advert.description ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  const handleUpload = async (file: File, mode: "create" | "edit") => {
    try {
      setUploading(true);
      const result = await uploadImage(file, token);
      if (mode === "create") {
        setCreating((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
      } else {
        setEditing((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
      }
    } finally {
      setUploading(false);
    }
  };

  const createAdvert = async () => {
    if (!creating) return;
    const resp = await apiFetch("/api/adverts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creating),
    });
    if (resp.ok) {
      setCreating(null);
      fetchAdverts();
    }
  };

  const saveAdvert = async () => {
    if (!editing) return;
    const resp = await apiFetch(`/api/adverts/${editing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editing),
    });
    if (resp.ok) {
      setEditing(null);
      fetchAdverts();
    }
  };

  const deleteAdvert = async (id: string) => {
    const resp = await apiFetch(`/api/adverts/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (resp.ok) {
      fetchAdverts();
    }
  };

  const renderForm = (advert: Advert, setAdvert: (advert: Advert) => void, mode: "create" | "edit") => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Eyebrow / Subtitle</Label>
        <Input value={advert.subtitle ?? ""} onChange={(e) => setAdvert({ ...advert, subtitle: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Main Title</Label>
        <Input value={advert.title} onChange={(e) => setAdvert({ ...advert, title: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          value={advert.description ?? ""}
          onChange={(e) => setAdvert({ ...advert, description: e.target.value })}
          rows={5}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Button Label</Label>
          <Input value={advert.ctaLabel ?? ""} onChange={(e) => setAdvert({ ...advert, ctaLabel: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Button Link</Label>
          <Input value={advert.ctaLink ?? ""} onChange={(e) => setAdvert({ ...advert, ctaLink: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Display Order</Label>
          <Input
            type="number"
            value={advert.displayOrder}
            onChange={(e) => setAdvert({ ...advert, displayOrder: Number(e.target.value || 0) })}
          />
        </div>
        <label className="mt-8 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={advert.active}
            onChange={(e) => setAdvert({ ...advert, active: e.target.checked })}
          />
          Active on market slider
        </label>
      </div>
      <div className="grid gap-2">
        <Label>Background Image</Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file, mode);
          }}
          disabled={uploading}
        />
        {uploading && <p className="text-sm text-muted-foreground">Uploading image...</p>}
        {advert.imageUrl && (
          <img
            src={resolveImageUrl(advert.imageUrl)}
            alt={advert.title}
            className="h-40 w-full rounded-xl object-cover"
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Admin Adverts</h1>
              <p className="mt-1 text-muted-foreground">
                Manage the market slider adverts, including title, copy, image, button text, and link.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search adverts"
                className="w-full lg:w-64"
              />
              <Dialog open={Boolean(creating)} onOpenChange={(open) => !open && setCreating(null)}>
                <DialogTrigger asChild>
                  <Button variant="hero" onClick={() => setCreating({ ...emptyAdvert, displayOrder: adverts.length })}>
                    New Advert
                  </Button>
                </DialogTrigger>
                <AdminFormDialog title="Create Advert" actionLabel="Create" onAction={createAdvert}>
                  {creating && renderForm(creating, setCreating, "create")}
                </AdminFormDialog>
              </Dialog>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((advert) => (
                  <TableRow key={advert.id}>
                    <TableCell>
                      {advert.imageUrl ? (
                        <img
                          src={resolveImageUrl(advert.imageUrl)}
                          alt={advert.title}
                          className="h-16 w-28 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{advert.title}</p>
                        <p className="text-sm text-muted-foreground">{advert.subtitle || "No subtitle"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={advert.active ? "default" : "outline"}>{advert.active ? "Active" : "Hidden"}</Badge>
                    </TableCell>
                    <TableCell>{advert.displayOrder}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{advert.ctaLabel || "No button label"}</p>
                        <p className="text-muted-foreground">{advert.ctaLink || "No link"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={editing?.id === advert.id} onOpenChange={(open) => !open && setEditing(null)}>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditing({ ...advert })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <AdminFormDialog title="Edit Advert" actionLabel="Save" onAction={saveAdvert}>
                            {editing && renderForm(editing, setEditing, "edit")}
                          </AdminFormDialog>
                        </Dialog>
                        <Button variant="outline" size="sm" onClick={() => deleteAdvert(advert.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No adverts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminAdverts;
