import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AdminFormDialog from "@/components/admin/AdminFormDialog";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, resolveImageUrl, uploadImage } from "@/lib/api";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { parseTicketQrPayload } from "@/lib/ticketQr";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  priceCents: number;
  status: "upcoming" | "past" | "cancelled";
};

const formatDate = (value?: string | null) => {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const statusVariant = (status: EventItem["status"]) => {
  if (status === "cancelled") return "destructive" as const;
  if (status === "past") return "secondary" as const;
  return "default" as const;
};

const emptyEvent: EventItem = {
  id: "",
  title: "",
  description: null,
  location: null,
  startDate: null,
  endDate: null,
  imageUrl: null,
  priceCents: 0,
  status: "upcoming",
};

const formatCurrency = (amountCents?: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);

const AdminEvents = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [creating, setCreating] = useState<EventItem | null>(null);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [filterStatus, setFilterStatus] = useState("all");
  const [startAfter, setStartAfter] = useState("");
  const [startBefore, setStartBefore] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchEvents = useCallback(async () => {
    const resp = await apiFetch("/api/events", { headers: authHeaders });
    if (resp.ok) setEvents(await resp.json());
  }, [authHeaders]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filtered = events.filter((event) => {
    const matchesQuery = `${event.title} ${event.location ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = filterStatus === "all" ? true : event.status === filterStatus;
    const start = event.startDate ? new Date(event.startDate).getTime() : null;
    const after = startAfter ? new Date(startAfter).getTime() : null;
    const before = startBefore ? new Date(startBefore).getTime() : null;
    const matchesAfter = after === null ? true : start !== null && start >= after;
    const matchesBefore = before === null ? true : start !== null && start <= before;
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
    } finally {
      setUploading(false);
    }
  };

  const exportCsv = () => {
    const rows = events.map((event) => ({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startDate: event.startDate ?? "",
      endDate: event.endDate ?? "",
      imageUrl: event.imageUrl ?? "",
      priceCents: event.priceCents,
      status: event.status,
    }));
    const csv = toCsv(rows, ["title", "description", "location", "startDate", "endDate", "imageUrl", "priceCents", "status"]);
    downloadCsv("events.csv", csv);
  };

  const downloadTemplate = () => {
    const csv = toCsv(
      [
        {
          title: "Midnight Car Meet",
          description: "Late night supercar showcase",
          location: "Nairobi",
          startDate: "2026-03-10",
          endDate: "2026-03-10",
          imageUrl: "/placeholder.svg",
          priceCents: "250000",
          status: "upcoming",
        },
      ],
      ["title", "description", "location", "startDate", "endDate", "imageUrl", "priceCents", "status"]
    );
    downloadCsv("events_template.csv", csv);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      await apiFetch("/api/events", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: row.title,
          description: row.description || null,
          location: row.location || null,
          startDate: row.startDate || null,
          endDate: row.endDate || null,
          imageUrl: row.imageUrl || null,
          priceCents: Number.parseInt(row.priceCents || "0", 10) || 0,
          status: row.status || "upcoming",
        }),
      });
    }
    fetchEvents();
  };

  const createEvent = async () => {
    if (!creating) return;
    const resp = await apiFetch("/api/events", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(creating),
    });
    if (resp.ok) {
      setCreating(null);
      fetchEvents();
    }
  };

  const saveEvent = async () => {
    if (!editing) return;
    const resp = await apiFetch(`/api/events/${editing.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify(editing),
    });
    if (resp.ok) {
      setEditing(null);
      fetchEvents();
    }
  };

  const deleteEvent = async (id: string) => {
    const resp = await apiFetch(`/api/events/${id}`, { method: "DELETE", headers: authHeaders });
    if (resp.ok) fetchEvents();
  };

  const checkInTicketNumber = useCallback(async (ticketValue: string) => {
    const normalized = ticketValue.trim().toUpperCase();
    if (!normalized) return;
    setCheckInLoading(true);
    setCheckInError(null);
    setCheckInResult(null);
    try {
      const resp = await apiFetch(`/api/event-registrations/tickets/${normalized}/check-in`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to check in ticket");
      }
      const ticket = await resp.json();
      setCheckInResult(`Checked in ${ticket.ticketNumber}`);
      setTicketCode("");
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Failed to check in ticket");
    } finally {
      setCheckInLoading(false);
    }
  }, [authHeaders]);

  const checkInTicket = async () => {
    await checkInTicketNumber(ticketCode);
  };

  const stopScanner = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setScanError(null);
    const Detector = window.BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanError("QR scanning is not supported on this browser. Use manual code entry.");
      return;
    }

    try {
      const supportedFormats = Detector.getSupportedFormats
        ? await Detector.getSupportedFormats()
        : ["qr_code"];
      if (!supportedFormats.includes("qr_code")) {
        setScanError("QR format is not supported on this device.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });
      const scanLoop = async () => {
        if (!videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          const rawValue = barcodes[0]?.rawValue;
          if (rawValue) {
            const parsedTicket = parseTicketQrPayload(rawValue);
            if (!parsedTicket) {
              setScanError("QR code is not a valid Drive Hub ticket.");
            } else {
              setTicketCode(parsedTicket);
              await checkInTicketNumber(parsedTicket);
              setScanOpen(false);
              return;
            }
          }
        } catch (error) {
          setScanError("Unable to read QR code from camera stream.");
        }
        rafRef.current = window.requestAnimationFrame(() => {
          void scanLoop();
        });
      };

      rafRef.current = window.requestAnimationFrame(() => {
        void scanLoop();
      });
    } catch (error) {
      setScanError("Camera access denied or unavailable.");
      stopScanner();
    }
  }, [checkInTicketNumber, stopScanner]);

  useEffect(() => {
    if (scanOpen) {
      void startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [scanOpen, startScanner, stopScanner]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display text-3xl tracking-wider">Admin Events</h1>
              <p className="text-muted-foreground mt-1">Create and manage events.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  <Button variant="hero" onClick={() => setCreating({ ...emptyEvent })}>
                    New Event
                  </Button>
                </DialogTrigger>
                <AdminFormDialog title="Create Event" actionLabel="Create" onAction={createEvent}>
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
                        <Label>Location</Label>
                        <Input
                          value={creating.location ?? ""}
                          onChange={(e) => setCreating({ ...creating, location: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={creating.startDate ?? ""}
                            onChange={(e) => setCreating({ ...creating, startDate: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={creating.endDate ?? ""}
                            onChange={(e) => setCreating({ ...creating, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Image URL</Label>
                        <Input
                          value={creating.imageUrl ?? ""}
                          onChange={(e) => setCreating({ ...creating, imageUrl: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Ticket Price (KES)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={Math.round((creating.priceCents || 0) / 100)}
                          onChange={(e) =>
                            setCreating({
                              ...creating,
                              priceCents: Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0) * 100,
                            })
                          }
                        />
                      </div>
                      {creating.imageUrl && (
                        <img
                          src={resolveImageUrl(creating.imageUrl)}
                          alt="Event"
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
                            setCreating({ ...creating, status: e.target.value as EventItem["status"] })
                          }
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="past">Past</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  )}
                </AdminFormDialog>
              </Dialog>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Search events..."
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
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Input
              type="date"
              value={startAfter}
              onChange={(e) => {
                setStartAfter(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              value={startBefore}
              onChange={(e) => {
                setStartBefore(e.target.value);
                setPage(1);
              }}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
              Page {page} of {totalPages}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium">Ticket Check-In</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter a ticket code to validate and check in attendees.
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="EVT-XXXXXXXXXX"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
              />
              <Button variant="hero" onClick={checkInTicket} disabled={checkInLoading || !ticketCode.trim()}>
                {checkInLoading ? "Checking..." : "Check In"}
              </Button>
              <Button variant="secondary" onClick={() => setScanOpen(true)}>
                Scan QR
              </Button>
            </div>
            {checkInResult && <p className="mt-2 text-sm text-emerald-500">{checkInResult}</p>}
            {checkInError && <p className="mt-2 text-sm text-destructive">{checkInError}</p>}
          </div>

          <Dialog open={scanOpen} onOpenChange={setScanOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Scan Ticket QR</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  className="w-full rounded-md border border-border bg-black"
                  autoPlay
                  muted
                  playsInline
                />
                <p className="text-sm text-muted-foreground">
                  Point the camera at the attendee QR code.
                </p>
                {scanError && <p className="text-sm text-destructive">{scanError}</p>}
              </div>
            </DialogContent>
          </Dialog>

          <div className="mt-8 rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Ticket Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.title}</TableCell>
                    <TableCell>{formatDate(event.startDate)}</TableCell>
                    <TableCell>{event.priceCents > 0 ? formatCurrency(event.priceCents) : "Free"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(event.status)} className="capitalize">
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editing?.id === event.id}
                          onOpenChange={(open) => {
                            if (!open) setEditing(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditing({ ...event })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <AdminFormDialog title="Edit Event" actionLabel="Save" onAction={saveEvent}>
                            {editing && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Title</Label>
                                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Description</Label>
                                  <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Location</Label>
                                  <Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <div className="grid gap-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={editing.startDate ?? ""} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={editing.endDate ?? ""} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
                                  </div>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Image URL</Label>
                                  <Input value={editing.imageUrl ?? ""} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Ticket Price (KES)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={Math.round((editing.priceCents || 0) / 100)}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        priceCents: Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0) * 100,
                                      })
                                    }
                                  />
                                </div>
                                {editing.imageUrl && (
                                  <img
                                    src={resolveImageUrl(editing.imageUrl)}
                                    alt="Event"
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
                                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as EventItem["status"] })}>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="past">Past</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </AdminFormDialog>
                        </Dialog>
                        <Button variant="destructive" size="sm" onClick={() => deleteEvent(event.id)}>
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

export default AdminEvents;
