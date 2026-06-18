import { useCallback, useEffect, useMemo, useState } from "react";
import AccountLayout from "@/components/shared/AccountLayout";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type Order = {
  id: string;
  totalCents: number;
  paymentMethod: string | null;
  paymentStatus: string;
  status: string;
  itemsCount: number;
  createdAt: string;
};

const statusVariant = (s?: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "paid") return "default";
  if (s === "pending") return "secondary";
  if (s === "cancelled" || s === "failed") return "destructive";
  return "outline";
};

const MyOrders = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchOrders = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/orders", { headers: authHeaders, signal });
      if (!resp.ok) throw new Error("Failed to load orders");
      const json = await resp.json();
      setOrders(Array.isArray(json) ? json : (json.data ?? []));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Failed to load your orders.");
      toast.error("Failed to load your orders.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders]);

  return (
    <AccountLayout title="My Orders">
      <div className="max-w-4xl">
        <p className="mb-6 text-sm text-muted-foreground">Your store purchase history.</p>

        {loading && <p className="text-sm text-muted-foreground">Loading orders…</p>}
        {!loading && error && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchOrders()}>Retry</Button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Your store purchases will appear here once you check out."
            action={{ label: "Browse Store", to: "/store" }}
          />
        )}

        {!loading && orders.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}…</TableCell>
                    <TableCell>{order.itemsCount}</TableCell>
                    <TableCell>KES {(order.totalCents / 100).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{order.paymentMethod ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.paymentStatus)}>
                        {order.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

export default MyOrders;
