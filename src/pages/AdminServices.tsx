import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl, uploadImage } from "@/lib/api";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";

type Service = {
  id: string;
  title: string;
  description: string | null;
  features: string[];
  priceCents: number | null;
  imageUrl: string | null;
  active: boolean;
};

const emptyService: Service = {
  id: "",
  title: "",
  description: null,
  features: [],
  priceCents: null,
  imageUrl: null,
  active: true,
};

const AdminServices = () => {
  const { token } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [creating, setCreating] = useState<Service | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filterActive, setFilterActive] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchServices = async () => {
    const resp = await apiFetch("/api/services", { headers: authHeaders });
    if (resp.ok) setServices(await resp.json());
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filtered = services.filter((service) => {
    const matchesQuery = service.title.toLowerCase().includes(query.toLowerCase());
    const matchesActive =
      filterActive === "all" ? true : service.active === (filterActive === "active");
    const price = service.priceCents ?? 0;
    const min = minPrice ? Number(minPrice) * 100 : null;
    const max = maxPrice ? Number(maxPrice) * 100 : null;
    const matchesMin = min === null ? true : price >= min;
    const matchesMax = max === null ? true : price <= max;
    return matchesQuery && matchesActive && matchesMin && matchesMax;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

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

  const exportCsv = () => {
    const rows = services.map((service) => ({
      title: service.title,
      description: service.description ?? "",
      features: service.features.join("|"),
      priceCents: service.priceCents ?? "",
      imageUrl: service.imageUrl ?? "",
      active: service.active ? "true" : "false",
    }));
    const csv = toCsv(rows, ["title", "description", "features", "priceCents", "imageUrl", "active"]);
    downloadCsv("services.csv", csv);
  };

  const downloadTemplate = () => {
    const csv = toCsv(
      [
        {
          title: "Performance Tuning",
          description: "ECU remap and performance upgrades",
          features: "ECU Remap|Exhaust|Intake",
          priceCents: 29900,
          imageUrl: "https://example.com/service.jpg",
          active: "true",
        },
      ],
      ["title", "description", "features", "priceCents", "imageUrl", "active"]
    );
    downloadCsv("services_template.csv", csv);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      await apiFetch("/api/services", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: row.title,
          description: row.description || null,
          features: row.features ? row.features.split("|").map((f) => f.trim()) : [],
          priceCents: row.priceCents ? Number(row.priceCents) : null,
          imageUrl: row.imageUrl || null,
          active: row.active === "true",
        }),
      });
    }
    fetchServices();
  };

  const createService = async () => {
    if (!creating) return;
    const resp = await apiFetch("/api/services", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creating),
    });
    if (resp.ok) {
      setCreating(null);
      fetchServices();
    }
  };

  const saveService = async () => {
    if (!editing) return;
    const resp = await apiFetch(`/api/services/${editing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editing),
    });
    if (resp.ok) {
      setEditing(null);
      fetchServices();
    }
  };

  const deleteService = async (id: string) => {
    const resp = await apiFetch(`/api/services/${id}`, { method: "DELETE", headers: authHeaders });
    if (resp.ok) fetchServices();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Admin Services</h1>
              <p className="text-muted-foreground mt-1">Create and manage services.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={downloadTemplate}>Template</Button>
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importCsv(file);
                  }}
                />
                <span className="inline-flex h-10 items-center rounded-md bg-secondary px-4 text-sm">Import CSV</span>
              </label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="hero" onClick={() => setCreating({ ...emptyService })}>
                    New Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Service</DialogTitle>
                  </DialogHeader>
                  {creating && (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Title</Label>
                        <Input
                          value={creating.title}
                          onChange={(e) => setCreating({ ...creating, title: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Description</Label>
                        <Textarea
                          value={creating.description ?? ""}
                          onChange={(e) => setCreating({ ...creating, description: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Features (comma separated)</Label>
                        <Input
                          value={creating.features.join(", ")}
                          onChange={(e) =>
                            setCreating({
                              ...creating,
                              features: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Price (KES)</Label>
                        <Input
                          type="number"
                          value={creating.priceCents ? creating.priceCents / 100 : 0}
                          onChange={(e) =>
                            setCreating({
                              ...creating,
                              priceCents: Math.round(Number(e.target.value || 0) * 100),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Image URL</Label>
                        <Input
                          value={creating.imageUrl ?? ""}
                          onChange={(e) => setCreating({ ...creating, imageUrl: e.target.value })}
                        />
                      </div>
                      {creating.imageUrl && (
                        <img
                          src={resolveImageUrl(creating.imageUrl)}
                          alt="Service"
                          className="h-32 w-full rounded-md object-cover border border-border"
                        />
                      )}
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
                      <div className="grid gap-2">
                        <Label>Active</Label>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={creating.active ? "yes" : "no"}
                          onChange={(e) =>
                            setCreating({ ...creating, active: e.target.value === "yes" })
                          }
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="hero" onClick={createService}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search services..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Input
              placeholder="Min price"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>{service.title}</TableCell>
                    <TableCell>{service.priceCents ? (service.priceCents / 100).toLocaleString() : "Quote"}</TableCell>
                    <TableCell>{service.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditing({ ...service })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Service</DialogTitle>
                            </DialogHeader>
                            {editing && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Title</Label>
                                  <Input
                                    value={editing.title}
                                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Description</Label>
                                  <Textarea
                                    value={editing.description ?? ""}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Features (comma separated)</Label>
                                  <Input
                                    value={editing.features.join(", ")}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        features: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Price (KES)</Label>
                                  <Input
                                    type="number"
                                    value={editing.priceCents ? editing.priceCents / 100 : 0}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        priceCents: Math.round(Number(e.target.value || 0) * 100),
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Image URL</Label>
                                  <Input
                                    value={editing.imageUrl ?? ""}
                                    onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })}
                                  />
                                </div>
                                {editing.imageUrl && (
                                  <img
                                    src={resolveImageUrl(editing.imageUrl)}
                                    alt="Service"
                                    className="h-32 w-full rounded-md object-cover border border-border"
                                  />
                                )}
                                <div className="grid gap-2">
                                  <Label>Upload Image</Label>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUpload(file, "edit");
                                    }}
                                    disabled={uploading}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Active</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editing.active ? "yes" : "no"}
                                    onChange={(e) => setEditing({ ...editing, active: e.target.value === "yes" })}
                                  >
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveService}>
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={() => deleteService(service.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminServices;
