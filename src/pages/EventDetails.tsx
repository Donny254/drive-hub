import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Calendar, MapPin } from "lucide-react";
import carEvent from "@/assets/car-event.jpg";
import { apiFetch, resolveImageUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/lib/feedback";
import CryptoProofUploader from "@/components/shared/CryptoProofUploader";
import CryptoPaymentTimeline from "@/components/shared/CryptoPaymentTimeline";
import CryptoPaymentDetails from "@/components/shared/CryptoPaymentDetails";
import useCryptoPaymentStatus from "@/hooks/useCryptoPaymentStatus";

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
  registrationsCount?: number;
};

type EventRegistration = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  tickets: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "TBA";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "TBA";
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return formatDate(start || end);
};

const statusBadgeVariant = (status: EventItem["status"]) => {
  if (status === "cancelled") return "destructive" as const;
  if (status === "past") return "secondary" as const;
  return "default" as const;
};

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tickets, setTickets] = useState(1);
  const [notes, setNotes] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [pendingRegistrationId, setPendingRegistrationId] = useState<string | null>(null);
  const [completedRegistrationId, setCompletedRegistrationId] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState("");
  const [payerWallet, setPayerWallet] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [cryptoDetails, setCryptoDetails] = useState<{
    asset: string;
    network: string | null;
    walletAddress: string | null;
    instructions: string | null;
  } | null>(null);
  const registerDialogRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = user?.role === "admin";

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const totalAmountCents = Number(event?.priceCents || 0) * tickets;

  const scrollRegisterDialog = (direction: "top" | "bottom") => {
    if (!registerDialogRef.current) return;
    registerDialogRef.current.scrollTo({
      top: direction === "top" ? 0 : registerDialogRef.current.scrollHeight,
      behavior: "smooth",
    });
  };
  const isPaidEvent = totalAmountCents > 0;
  const {
    data: cryptoStatusData,
    loading: cryptoStatusLoading,
    error: cryptoStatusError,
    refresh: refreshCryptoStatus,
  } = useCryptoPaymentStatus(
    completedRegistrationId ? `/api/payments/crypto/event-registration-status/${completedRegistrationId}` : null,
    Boolean(registerOpen && paymentMethod === "crypto" && completedRegistrationId),
    5000,
    authHeaders
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await apiFetch(`/api/events/${id}`);
        if (!resp.ok) throw new Error("Failed to load event");
        setEvent(await resp.json());
      } catch {
        setError("Event not found.");
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  useEffect(() => {
    const loadRegistrations = async () => {
      if (!event || user?.role !== "admin") return;
      try {
        setRegistrationsLoading(true);
        setRegistrationsError(null);
        const resp = await apiFetch(`/api/event-registrations?eventId=${event.id}`, {
          headers: authHeaders,
        });
        if (!resp.ok) throw new Error("Failed to load registrations");
        setRegistrations(await resp.json());
      } catch (err) {
        console.error(err);
        setRegistrationsError("Failed to load registrations.");
      } finally {
        setRegistrationsLoading(false);
      }
    };
    loadRegistrations();
  }, [event, user, authHeaders]);

  useEffect(() => {
    const loadCryptoDetails = async () => {
      const resp = await apiFetch("/api/payments/crypto-details");
      if (resp.ok) {
        setCryptoDetails(await resp.json().catch(() => null));
      }
    };
    void loadCryptoDetails();
  }, []);

  useEffect(() => {
    if (!registerOpen) return;
    setRegisterError(null);
    setRegisterSuccess(null);
    setContactName(user?.name || user?.email || "");
    setContactPhone("");
    setTickets(1);
    setNotes("");
    setPaymentMethod("mpesa");
    setPendingRegistrationId(null);
    setCompletedRegistrationId(null);
    setTransactionHash("");
    setPayerWallet("");
    setProofImageUrl(null);
  }, [registerOpen, user]);

  const openRegister = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRegisterOpen(true);
  };

  const submitRegistration = async () => {
    if (!event) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      setRegisterError("Name and phone are required.");
      toast.error("Name and phone are required.");
      return;
    }
    if (isPaidEvent && paymentMethod === "crypto" && !transactionHash.trim()) {
      setRegisterError("Transaction hash is required for crypto payment.");
      toast.error("Transaction hash is required for crypto payment.");
      return;
    }
    if (isPaidEvent && paymentMethod === "crypto" && !proofImageUrl) {
      setRegisterError("Payment proof image is required for crypto payment.");
      toast.error("Payment proof image is required for crypto payment.");
      return;
    }
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const resp = await apiFetch("/api/event-registrations", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          eventId: event.id,
          contactName,
          contactPhone,
          tickets,
          notes: notes || null,
        }),
      });

      if (!resp.ok) {
        throw new Error(await getApiErrorMessage(resp, "Failed to register for event"));
      }

      const data = (await resp.json().catch(() => ({}))) as {
        id?: string;
        paymentRequired?: boolean;
        message?: string;
      };

      if (data.paymentRequired) {
        const paymentResp = await apiFetch(
          paymentMethod === "crypto"
            ? "/api/payments/crypto/event-registration"
            : "/api/payments/mpesa/stkpush-event-registration",
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              registrationId: data.id,
              phoneNumber: contactPhone,
              contactPhone,
              transactionHash,
              payerWallet,
              proofImageUrl,
              asset: cryptoDetails?.asset,
              network: cryptoDetails?.network,
            }),
          }
        );
        if (!paymentResp.ok) {
          throw new Error(
            await getApiErrorMessage(
              paymentResp,
              paymentMethod === "crypto"
                ? "Failed to submit crypto payment"
                : "Failed to initiate M-Pesa payment"
            )
          );
        }
        if (paymentMethod === "mpesa") {
          setPendingRegistrationId(data.id || null);
        } else {
          setCompletedRegistrationId(data.id || null);
        }
        const successMessage =
          paymentMethod === "crypto"
            ? data?.message || "Crypto payment submitted for review. Your tickets will be generated after approval."
            : data?.message || "M-Pesa prompt sent. Complete payment to generate your tickets.";
        setRegisterSuccess(successMessage);
        toast.success(
          paymentMethod === "crypto"
            ? "Crypto payment submitted for review."
            : "M-Pesa prompt sent. Complete payment on your phone."
        );
      } else {
        setRegisterSuccess("Registration submitted. Your tickets are ready.");
        setCompletedRegistrationId(data.id || null);
        toast.success("Registration submitted. Your tickets are ready.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register.";
      setRegisterError(message);
      toast.error(message);
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {loading && <p className="text-muted-foreground">Loading event...</p>}
          {!loading && error && <p className="text-destructive">{error}</p>}

          {!loading && event && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
                    {event.status}
                  </Badge>
                  <Badge variant="secondary">
                    {formatDateRange(event.startDate, event.endDate)}
                  </Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
                  Back
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h1 className="font-display text-4xl tracking-wider">{event.title}</h1>
                  <p className="text-muted-foreground text-lg">
                    {event.description ?? "Details coming soon."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar size={16} />
                        Schedule
                      </div>
                      <p className="mt-2 font-medium">
                        {formatDateRange(event.startDate, event.endDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={16} />
                        Location
                      </div>
                      <p className="mt-2 font-medium">{event.location ?? "TBA"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Registrations</p>
                      <p className="mt-2 font-medium">{event.registrationsCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {event.status === "upcoming" && (
                      <Button variant="hero" size="lg" onClick={openRegister}>
                        Register Now
                      </Button>
                    )}
                    {user?.role === "admin" && (
                      <Badge variant="secondary">Admin view</Badge>
                    )}
                  </div>
                </div>

                <img
                  src={resolveImageUrl(event.imageUrl) || carEvent}
                  alt={event.title}
                  className="w-full rounded-2xl border border-border object-cover min-h-[320px]"
                />
              </div>

              {user?.role === "admin" && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h2 className="font-display text-2xl tracking-wider">Registrations</h2>
                  {registrationsLoading && (
                    <p className="text-muted-foreground mt-2">Loading registrations...</p>
                  )}
                  {registrationsError && (
                    <p className="text-sm text-destructive mt-2">{registrationsError}</p>
                  )}
                  {!registrationsLoading && !registrationsError && (
                    <div className="mt-4 rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Tickets</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrations.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-muted-foreground">
                                No registrations yet.
                              </TableCell>
                            </TableRow>
                          )}
                          {registrations.map((reg) => (
                            <TableRow key={reg.id}>
                              <TableCell>{reg.contactName ?? "--"}</TableCell>
                              <TableCell>{reg.contactPhone ?? "--"}</TableCell>
                              <TableCell>{reg.tickets}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    reg.status === "confirmed"
                                      ? "default"
                                      : reg.status === "cancelled"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="capitalize"
                                >
                                  {reg.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(reg.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" ref={registerDialogRef}>
          <DialogHeader>
            <DialogTitle>Register{event ? `: ${event.title}` : ""}</DialogTitle>
            <DialogDescription>
              Share your attendee details and ticket quantity to register for this event. We will use your phone number for payment and ticket confirmation when required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollRegisterDialog("top")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Scroll to top
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollRegisterDialog("bottom")}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Scroll to payment
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            {isPaidEvent && (
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "mpesa" | "crypto")}
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tickets</Label>
              <Input
                type="number"
                min={1}
                value={tickets}
                onChange={(e) => setTickets(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {isPaidEvent && (
              <div className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Ticket price</span>
                  <span className="font-medium">KES {Number(event?.priceCents || 0).toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tickets</span>
                  <span className="font-medium">{tickets}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold text-primary">KES {totalAmountCents.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Payment method</span>
                  <span className="text-xs font-medium capitalize text-muted-foreground">{paymentMethod}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {paymentMethod === "crypto"
                    ? "Crypto payments are reviewed before tickets are issued."
                    : "M-Pesa payment prompt will be sent after submission."}
                </p>
              </div>
            )}
            {isPaidEvent && paymentMethod === "crypto" && (
              <div className="rounded-md border border-border bg-card p-3 text-sm">
                <p className="font-medium">Crypto payment instructions</p>
                <p className="mt-2 text-muted-foreground capitalize">
                  {cryptoDetails?.asset || "USDT"}
                  {cryptoDetails?.network ? ` on ${cryptoDetails.network}` : ""}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-primary">
                  {cryptoDetails?.walletAddress || "Wallet not configured"}
                </p>
                {cryptoDetails?.instructions ? (
                  <p className="mt-2 text-muted-foreground">{cryptoDetails.instructions}</p>
                ) : null}
              </div>
            )}
            {isPaidEvent && paymentMethod === "crypto" && (
              <div className="grid gap-4">
                <CryptoProofUploader
                  token={token}
                  proofImageUrl={proofImageUrl}
                  onProofImageUrlChange={setProofImageUrl}
                  label="Payment proof"
                  description="Upload a clear transfer screenshot or receipt before submitting."
                />
                <div className="grid gap-2">
                  <Label>Transaction Hash</Label>
                  <Input value={transactionHash} onChange={(e) => setTransactionHash(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Payer Wallet (optional)</Label>
                  <Input value={payerWallet} onChange={(e) => setPayerWallet(e.target.value)} />
                </div>
              </div>
            )}
            <div className="sticky bottom-4 z-20 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => scrollRegisterDialog("top")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Back to top
              </Button>
            </div>
            {isPaidEvent && paymentMethod === "crypto" && completedRegistrationId && (
              <CryptoPaymentTimeline
                resource={cryptoStatusData?.resource || null}
                transaction={cryptoStatusData?.transaction || null}
                loading={cryptoStatusLoading}
                error={cryptoStatusError}
                onRefresh={refreshCryptoStatus}
                refreshing={cryptoStatusLoading}
              />
            )}
            {registerError && <p className="text-sm text-destructive">{registerError}</p>}
            {registerSuccess && <p className="text-sm text-emerald-500">{registerSuccess}</p>}
            {pendingRegistrationId && paymentMethod === "mpesa" && (
              <p className="text-sm text-muted-foreground">Waiting for M-Pesa confirmation...</p>
            )}
          </div>
          <DialogFooter>
            {registerSuccess ? (
              <Button variant="hero" onClick={() => setRegisterOpen(false)}>
                Done
              </Button>
            ) : (
              <Button variant="hero" onClick={submitRegistration} disabled={registerLoading || !!pendingRegistrationId}>
                {registerLoading
                  ? paymentMethod === "crypto"
                    ? "Submitting..."
                    : "Requesting..."
                  : pendingRegistrationId
                    ? "Waiting..."
                    : isPaidEvent
                      ? paymentMethod === "crypto"
                        ? "Submit Crypto Payment"
                        : "Pay with M-Pesa"
                      : "Submit Registration"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetails;
