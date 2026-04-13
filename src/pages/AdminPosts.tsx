import { useCallback, useEffect, useMemo, useState } from "react";
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
import { toast } from "@/components/ui/sonner";
import { feedbackText, getApiErrorMessage } from "@/lib/feedback";
import DatePickerField from "@/components/shared/DatePickerField";
import { getTodayDateValue, isPastDateTimeLocalValue, isEndBeforeStart } from "@/lib/date";
import DateTimePickerField from "@/components/shared/DateTimePickerField";

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const emptyPost: Post = {
  id: "",
  title: "",
  excerpt: null,
  content: null,
  imageUrl: null,
  status: "draft",
  publishedAt: null,
};

const AdminPosts = () => {
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [creating, setCreating] = useState<Post | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filterStatus, setFilterStatus] = useState("all");
  const [startAfter, setStartAfter] = useState("");
  const [startBefore, setStartBefore] = useState("");
  const todayDate = useMemo(() => getTodayDateValue(), []);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchPosts = useCallback(async () => {
    const resp = await apiFetch("/api/posts", { headers: authHeaders });
    if (resp.ok) {
      setPosts(await resp.json());
      return;
    }
    toast.error(await getApiErrorMessage(resp, "Failed to load posts"));
  }, [authHeaders]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered = posts.filter((post) => {
    const matchesQuery = post.title.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = filterStatus === "all" ? true : post.status === filterStatus;
    const published = post.publishedAt ? new Date(post.publishedAt).getTime() : null;
    const after = startAfter ? new Date(startAfter).getTime() : null;
    const before = startBefore ? new Date(startBefore).getTime() : null;
    const matchesAfter = after === null ? true : published !== null && published >= after;
    const matchesBefore = before === null ? true : published !== null && published <= before;
    return matchesQuery && matchesStatus && matchesAfter && matchesBefore;
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
      toast.success(feedbackText.uploaded());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const exportCsv = () => {
    const rows = posts.map((post) => ({
      title: post.title,
      excerpt: post.excerpt ?? "",
      content: post.content ?? "",
      imageUrl: post.imageUrl ?? "",
      status: post.status,
      publishedAt: post.publishedAt ?? "",
    }));
    const csv = toCsv(rows, ["title", "excerpt", "content", "imageUrl", "status", "publishedAt"]);
    downloadCsv("posts.csv", csv);
  };

  const downloadTemplate = () => {
    const csv = toCsv(
      [
        {
          title: "Electric Supercars",
          excerpt: "The rise of EV performance",
          content: "Full content goes here",
          imageUrl: "/placeholder.svg",
          status: "published",
          publishedAt: "2026-03-01T10:00",
        },
      ],
      ["title", "excerpt", "content", "imageUrl", "status", "publishedAt"]
    );
    downloadCsv("posts_template.csv", csv);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      const resp = await apiFetch("/api/posts", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: row.title,
          excerpt: row.excerpt || null,
          content: row.content || null,
          imageUrl: row.imageUrl || null,
          status: row.status || "draft",
          publishedAt: row.publishedAt || null,
        }),
      });
      if (!resp.ok) {
        toast.error(await getApiErrorMessage(resp, "Failed to import posts"));
        return;
      }
    }
    await fetchPosts();
    toast.success(feedbackText.imported("post", rows.length));
  };

  const createPost = async () => {
    if (!creating) return;
    if (creating.publishedAt && isPastDateTimeLocalValue(creating.publishedAt)) {
      toast.error("Published date cannot be in the past.");
      return;
    }
    const resp = await apiFetch("/api/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creating),
    });
    if (resp.ok) {
      setCreating(null);
      await fetchPosts();
      toast.success(feedbackText.created("post"));
      return;
    }
    toast.error(await getApiErrorMessage(resp, "Failed to create post"));
  };

  const savePost = async () => {
    if (!editing) return;
    if (editing.publishedAt && isPastDateTimeLocalValue(editing.publishedAt)) {
      toast.error("Published date cannot be in the past.");
      return;
    }
    const resp = await apiFetch(`/api/posts/${editing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editing),
    });
    if (resp.ok) {
      setEditing(null);
      await fetchPosts();
      toast.success(feedbackText.updated("post"));
      return;
    }
    toast.error(await getApiErrorMessage(resp, "Failed to update post"));
  };

  const deletePost = async (id: string) => {
    const resp = await apiFetch(`/api/posts/${id}`, { method: "DELETE", headers: authHeaders });
    if (resp.ok) {
      await fetchPosts();
      toast.success(feedbackText.deleted("post"));
      return;
    }
    toast.error(await getApiErrorMessage(resp, "Failed to delete post"));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Admin Blog</h1>
              <p className="text-muted-foreground mt-1">Create and manage blog posts.</p>
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
              <Dialog
                open={Boolean(creating)}
                onOpenChange={(open) => {
                  if (!open) setCreating(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="hero" onClick={() => setCreating({ ...emptyPost })}>
                    New Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Post</DialogTitle>
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
                        <Label>Excerpt</Label>
                        <Textarea
                          value={creating.excerpt ?? ""}
                          onChange={(e) => setCreating({ ...creating, excerpt: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Content</Label>
                        <Textarea
                          value={creating.content ?? ""}
                          onChange={(e) => setCreating({ ...creating, content: e.target.value })}
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
                          alt="Post"
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
                        <Label>Status</Label>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={creating.status}
                          onChange={(e) =>
                            setCreating({ ...creating, status: e.target.value as Post["status"] })
                          }
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Published At</Label>
                        <DateTimePickerField
                          value={creating.publishedAt ?? ""}
                          onChange={(value) => setCreating({ ...creating, publishedAt: value })}
                          minDate={todayDate}
                        />
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="hero" onClick={createPost}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search posts..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <DatePickerField
              value={startAfter}
              onChange={(value) => {
                setStartAfter(value);
                if (startBefore && isEndBeforeStart(value, startBefore)) setStartBefore(value);
                setPage(1);
              }}
              minDate={todayDate}
              placeholder="Published after"
            />
            <DatePickerField
              value={startBefore}
              onChange={(value) => {
                setStartBefore(value);
                setPage(1);
              }}
              minDate={startAfter || todayDate}
              placeholder="Published before"
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
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>{post.title}</TableCell>
                    <TableCell className="capitalize">{post.status}</TableCell>
                    <TableCell>{post.publishedAt ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editing?.id === post.id}
                          onOpenChange={(open) => {
                            if (!open) setEditing(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditing({ ...post })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Post</DialogTitle>
                            </DialogHeader>
                            {editing && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Title</Label>
                                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Excerpt</Label>
                                  <Textarea value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Content</Label>
                                  <Textarea value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Image URL</Label>
                                  <Input value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} />
                                </div>
                                {editing.imageUrl && (
                                  <img
                                    src={resolveImageUrl(editing.imageUrl)}
                                    alt="Post"
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
                                  <Label>Status</Label>
                                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Post["status"] })}>
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Published At</Label>
                                  <DateTimePickerField
                                    value={editing.publishedAt ?? ""}
                                    onChange={(value) => setEditing({ ...editing, publishedAt: value })}
                                    minDate={todayDate}
                                  />
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={savePost}>Save</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={() => deletePost(post.id)}>
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

export default AdminPosts;
