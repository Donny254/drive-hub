import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccountLayout from "@/components/shared/AccountLayout";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    if (!token) return;
    const authHeaders = { Authorization: `Bearer ${token}` };
    setLoading(true);
    apiFetch("/api/orders", { headers: authHeaders })
      .then(async (resp) => {
        if (!resp.ok) throw new Error("Failed to load orders");
        const json = await resp.json();
        setOrders(Array.isArray(json) ? json : (json.data ?? []));
      })
      .catch(() => {
        setError("Failed to load your orders.");
        toast.error("Failed to load your orders.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AccountLayout title="My Orders">
      <div className="max-w-4xl">
        <p className="mb-6 text-sm text-muted-foreground">Your store purchase history.</p>

        {loading && <p className="text-sm text-muted-foreground">Loading orders…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">You haven't placed any orders yet.</p>
            <Link
              to="/store"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Browse the store
            </Link>
          </div>
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
