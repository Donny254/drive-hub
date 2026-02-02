import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl, uploadImage } from "@/lib/api";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string | null;
  imageUrl: string | null;
  sizes: string[];
  stock: number;
  active: boolean;
};

const formatMoney = (cents?: number | null) => {
  if (!cents) return "KES 0";
  return `KES ${(cents / 100).toLocaleString()}`;
};

const emptyProduct: Product = {
  id: "",
  name: "",
  description: null,
  priceCents: 0,
  category: null,
  imageUrl: null,
  sizes: [],
  stock: 0,
  active: true,
};

const AdminProducts = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filterActive, setFilterActive] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchProducts = async () => {
    const resp = await apiFetch("/api/products", { headers: authHeaders });
    if (resp.ok) setProducts(await resp.json());
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((product) => {
    const matchesQuery = `${product.name} ${product.category ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesActive =
      filterActive === "all" ? true : product.active === (filterActive === "active");
    const matchesCategory = filterCategory ? product.category === filterCategory : true;
    const price = product.priceCents ?? 0;
    const min = minPrice ? Number(minPrice) * 100 : null;
    const max = maxPrice ? Number(maxPrice) * 100 : null;
    const matchesMin = min === null ? true : price >= min;
    const matchesMax = max === null ? true : price <= max;
    return matchesQuery && matchesActive && matchesCategory && matchesMin && matchesMax;
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
    const rows = products.map((product) => ({
      name: product.name,
      description: product.description ?? "",
      priceCents: product.priceCents,
      category: product.category ?? "",
      imageUrl: product.imageUrl ?? "",
      sizes: product.sizes.join("|"),
      stock: product.stock,
      active: product.active ? "true" : "false",
    }));
    const csv = toCsv(rows, ["name", "description", "priceCents", "category", "imageUrl", "sizes", "stock", "active"]);
    downloadCsv("products.csv", csv);
  };

  const downloadTemplate = () => {
    const csv = toCsv(
      [
        {
          name: "WheelsnationKe Hoodie",
          description: "Premium cotton hoodie",
          priceCents: 8900,
          category: "Apparel",
          imageUrl: "https://example.com/hoodie.jpg",
          sizes: "S|M|L|XL",
          stock: 20,
          active: "true",
        },
      ],
      ["name", "description", "priceCents", "category", "imageUrl", "sizes", "stock", "active"]
    );
    downloadCsv("products_template.csv", csv);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      await apiFetch("/api/products", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: row.name,
          description: row.description || null,
          priceCents: row.priceCents ? Number(row.priceCents) : 0,
          category: row.category || null,
          imageUrl: row.imageUrl || null,
          sizes: row.sizes ? row.sizes.split("|").map((s) => s.trim()) : [],
          stock: row.stock ? Number(row.stock) : 0,
          active: row.active === "true",
        }),
      });
    }
    fetchProducts();
  };

  const createProduct = async () => {
    if (!creating) return;
    const resp = await apiFetch("/api/products", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creating),
    });
    if (resp.ok) {
      setCreating(null);
      fetchProducts();
    }
  };

  const saveProduct = async () => {
    if (!editing) return;
    const resp = await apiFetch(`/api/products/${editing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editing),
    });
    if (resp.ok) {
      setEditing(null);
      fetchProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    const resp = await apiFetch(`/api/products/${id}`, { method: "DELETE", headers: authHeaders });
    if (resp.ok) fetchProducts();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Admin Products</h1>
              <p className="text-muted-foreground mt-1">Create and manage store products.</p>
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
                  <Button variant="hero" onClick={() => setCreating({ ...emptyProduct })}>
                    New Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Product</DialogTitle>
                  </DialogHeader>
                  {creating && (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input
                          value={creating.name}
                          onChange={(e) => setCreating({ ...creating, name: e.target.value })}
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
                        <Label>Price (KES)</Label>
                        <Input
                          type="number"
                          value={creating.priceCents / 100}
                          onChange={(e) =>
                            setCreating({
                              ...creating,
                              priceCents: Math.round(Number(e.target.value || 0) * 100),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Input
                          value={creating.category ?? ""}
                          onChange={(e) => setCreating({ ...creating, category: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Sizes (comma separated)</Label>
                        <Input
                          value={creating.sizes.join(", ")}
                          onChange={(e) =>
                            setCreating({
                              ...creating,
                              sizes: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                            })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Stock</Label>
                        <Input
                          type="number"
                          value={creating.stock}
                          onChange={(e) =>
                            setCreating({ ...creating, stock: Number(e.target.value || 0) })
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
                          alt="Product"
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
                    <Button variant="hero" onClick={createProduct}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="Category"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
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
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{formatMoney(product.priceCents)}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      <Badge variant={product.active ? "default" : "secondary"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditing({ ...product })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Product</DialogTitle>
                            </DialogHeader>
                            {editing && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Name</Label>
                                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Description</Label>
                                  <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Price (KES)</Label>
                                  <Input type="number" value={editing.priceCents / 100} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value || 0) * 100) })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Category</Label>
                                  <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Sizes (comma separated)</Label>
                                  <Input value={editing.sizes.join(", ")} onChange={(e) => setEditing({ ...editing, sizes: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Stock</Label>
                                  <Input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value || 0) })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Image URL</Label>
                                  <Input value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} />
                                </div>
                                {editing.imageUrl && (
                                  <img
                                    src={resolveImageUrl(editing.imageUrl)}
                                    alt="Product"
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
                                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={editing.active ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, active: e.target.value === "yes" })}>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveProduct}>Save</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={() => deleteProduct(product.id)}>
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

export default AdminProducts;
