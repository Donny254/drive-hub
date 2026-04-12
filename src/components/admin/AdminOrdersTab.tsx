import type { Dispatch, SetStateAction } from "react";
import type { DeleteTarget, Order, OrderItem } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { resolveImageUrl } from "@/lib/api";
import CryptoProofUploader from "@/components/shared/CryptoProofUploader";

type AdminOrdersTabProps = {
  orders: Order[];
  editingOrder: Order | null;
  setEditingOrder: Dispatch<SetStateAction<Order | null>>;
  saveOrder: () => Promise<void> | void;
  loadOrderDetails: (orderId: string) => Promise<void> | void;
  orderDetailsOpen: boolean;
  setOrderDetailsOpen: Dispatch<SetStateAction<boolean>>;
  orderDetails: { order: Order; items: OrderItem[] } | null;
  orderDetailsLoading: boolean;
  orderDetailsError: string | null;
  setDeleteTarget: Dispatch<SetStateAction<DeleteTarget>>;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
  formatMoney: (cents?: number | null) => string;
  token?: string | null;
};

const AdminOrdersTab = ({
  orders,
  editingOrder,
  setEditingOrder,
  saveOrder,
  loadOrderDetails,
  orderDetailsOpen,
  setOrderDetailsOpen,
  orderDetails,
  orderDetailsLoading,
  orderDetailsError,
  setDeleteTarget,
  statusVariant,
  formatMoney,
  token,
}: AdminOrdersTabProps) => {
  return (
    <TabsContent value="orders" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Orders Workspace</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Track fulfillment, payment state, and basket details without opening every row first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {orders.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {orders.filter((order) => order.status === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {orders.filter((order) => order.paymentStatus === "paid" || order.status === "paid").length} paid
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{order.id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                      User {order.userId.slice(0, 8)} • {order.itemsCount ?? 0} items
                    </p>
                  </div>
                  <Badge variant={statusVariant(order.status)} className="capitalize">
                    {order.status}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>{formatMoney(order.totalCents)}</p>
                  <p className="capitalize">{order.paymentMethod ?? "manual"} • {order.paymentStatus ?? "unpaid"}</p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => loadOrderDetails(order.id)}>
                    View
                  </Button>
                  <Dialog
                    open={editingOrder?.id === order.id}
                    onOpenChange={(open) => {
                      if (!open) setEditingOrder(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditingOrder({ ...order })}>
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Order</DialogTitle>
                        <DialogDescription>
                          Update the order total or payment status for this purchase before saving your changes.
                        </DialogDescription>
                      </DialogHeader>
                      {editingOrder && (
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label>Total (cents)</Label>
                            <Input
                              type="number"
                              value={editingOrder.totalCents}
                              onChange={(e) =>
                                setEditingOrder({
                                  ...editingOrder,
                                  totalCents: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Status</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingOrder.status}
                              onChange={(e) =>
                                setEditingOrder({
                                  ...editingOrder,
                                  status: e.target.value as Order["status"],
                                })
                              }
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="refunded">Refunded</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment Method</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingOrder.paymentMethod ?? ""}
                              onChange={(e) =>
                                setEditingOrder({
                                  ...editingOrder,
                                  paymentMethod: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Not set</option>
                              <option value="mpesa">M-Pesa</option>
                              <option value="crypto">Crypto</option>
                              <option value="bank">Bank</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment Status</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingOrder.paymentStatus ?? "unpaid"}
                              onChange={(e) =>
                                setEditingOrder({
                                  ...editingOrder,
                                  paymentStatus: e.target.value as Order["paymentStatus"],
                                })
                              }
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="failed">Failed</option>
                            </select>
                          </div>
                          {editingOrder.paymentMethod === "crypto" && (
                            <div className="grid gap-4">
                              <CryptoProofUploader
                                token={token}
                                proofImageUrl={editingOrder.cryptoProofImageUrl ?? null}
                                onProofImageUrlChange={(value) =>
                                  setEditingOrder({
                                    ...editingOrder,
                                    cryptoProofImageUrl: value,
                                  })
                                }
                                label="Crypto Proof Image"
                                description="Upload or replace the crypto transfer proof linked to this order."
                              />
                              <div className="grid gap-2">
                                <Label>Crypto Review Notes</Label>
                                <Textarea
                                  value={editingOrder.cryptoReviewNotes ?? ""}
                                  onChange={(e) =>
                                    setEditingOrder({
                                      ...editingOrder,
                                      cryptoReviewNotes: e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="hero" onClick={saveOrder}>
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "order",
                        id: order.id,
                        label: order.id.slice(0, 8),
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.id.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          User {order.userId.slice(0, 8)} • {order.itemsCount ?? 0} items
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)} className="capitalize">
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{formatMoney(order.totalCents)}</p>
                        <p className="mt-1 text-xs text-muted-foreground capitalize">
                          {order.paymentMethod ?? "manual"} • {order.paymentStatus ?? "unpaid"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => loadOrderDetails(order.id)}>
                          View
                        </Button>
                        <Dialog
                          open={editingOrder?.id === order.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingOrder(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" onClick={() => setEditingOrder({ ...order })}>
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Order</DialogTitle>
                              <DialogDescription>
                                Update the order total or payment status for this purchase before saving your changes.
                              </DialogDescription>
                            </DialogHeader>
                            {editingOrder && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Total (cents)</Label>
                                  <Input
                                    type="number"
                                    value={editingOrder.totalCents}
                                    onChange={(e) =>
                                      setEditingOrder({
                                        ...editingOrder,
                                        totalCents: Number(e.target.value),
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingOrder.status}
                                    onChange={(e) =>
                                      setEditingOrder({
                                        ...editingOrder,
                                        status: e.target.value as Order["status"],
                                      })
                                    }
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="refunded">Refunded</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Payment Method</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingOrder.paymentMethod ?? ""}
                                    onChange={(e) =>
                                      setEditingOrder({
                                        ...editingOrder,
                                        paymentMethod: e.target.value || null,
                                      })
                                    }
                                  >
                                    <option value="">Not set</option>
                                    <option value="mpesa">M-Pesa</option>
                                    <option value="crypto">Crypto</option>
                                    <option value="bank">Bank</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Payment Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingOrder.paymentStatus ?? "unpaid"}
                                    onChange={(e) =>
                                      setEditingOrder({
                                        ...editingOrder,
                                        paymentStatus: e.target.value as Order["paymentStatus"],
                                      })
                                    }
                                  >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="failed">Failed</option>
                                  </select>
                                </div>
                          {editingOrder.paymentMethod === "crypto" && (
                                <div className="grid gap-4">
                                  <CryptoProofUploader
                                    token={token}
                                    proofImageUrl={editingOrder.cryptoProofImageUrl ?? null}
                                    onProofImageUrlChange={(value) =>
                                      setEditingOrder({
                                        ...editingOrder,
                                        cryptoProofImageUrl: value,
                                      })
                                    }
                                    label="Crypto Proof Image"
                                    description="Upload or replace the crypto transfer proof linked to this order."
                                  />
                                  <div className="grid gap-2">
                                    <Label>Crypto Review Notes</Label>
                                    <Textarea
                                      value={editingOrder.cryptoReviewNotes ?? ""}
                                      onChange={(e) =>
                                        setEditingOrder({
                                          ...editingOrder,
                                          cryptoReviewNotes: e.target.value || null,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              )}
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveOrder}>
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "order",
                              id: order.id,
                              label: order.id.slice(0, 8),
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Review the full order summary, customer reference, and line items for this purchase.
            </DialogDescription>
          </DialogHeader>
          {orderDetailsLoading && <p className="text-muted-foreground">Loading order details...</p>}
          {orderDetailsError && <p className="text-sm text-destructive">{orderDetailsError}</p>}
          {orderDetails && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Order ID: {orderDetails.order.id}</p>
                <p className="text-sm text-muted-foreground">User: {orderDetails.order.userId}</p>
                <p className="text-sm text-muted-foreground capitalize">Status: {orderDetails.order.status}</p>
                <p className="text-sm text-muted-foreground">
                  Total: {(orderDetails.order.totalCents / 100).toLocaleString()}
                </p>
              </div>

              {orderDetails.items.length === 0 ? (
                <p className="text-muted-foreground">No items recorded for this order.</p>
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderDetails.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img
                                  src={resolveImageUrl(item.imageUrl)}
                                  alt={item.name}
                                  className="h-10 w-10 rounded-md border border-border object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md border border-dashed border-border bg-secondary/40" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.size && (
                                  <p className="text-xs text-muted-foreground">Size: {item.size}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatMoney(item.priceCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="hero" onClick={() => setOrderDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
};

export default AdminOrdersTab;
