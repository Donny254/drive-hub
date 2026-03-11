import type { Dispatch, SetStateAction } from "react";
import type { ServiceBooking } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AdminServiceBookingsTabProps = {
  serviceBookings: ServiceBooking[];
  editingServiceBooking: ServiceBooking | null;
  setEditingServiceBooking: Dispatch<SetStateAction<ServiceBooking | null>>;
  saveServiceBooking: () => Promise<void> | void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
};

const AdminServiceBookingsTab = ({
  serviceBookings,
  editingServiceBooking,
  setEditingServiceBooking,
  saveServiceBooking,
  statusVariant,
}: AdminServiceBookingsTabProps) => {
  return (
    <TabsContent value="service-bookings" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Service Bookings</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep service schedules and status changes readable without a wide booking grid.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {serviceBookings.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {serviceBookings.filter((booking) => booking.status === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {serviceBookings.filter((booking) => booking.status === "confirmed").length} confirmed
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{booking.serviceTitle ?? booking.serviceId.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Booking {booking.id.slice(0, 8)} • User {booking.userId?.slice(0, 8) ?? "--"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{booking.scheduledDate ?? "--"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(booking.status)} className="capitalize">
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingServiceBooking?.id === booking.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingServiceBooking(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingServiceBooking({ ...booking })}
                            >
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Service Booking</DialogTitle>
                            </DialogHeader>
                            {editingServiceBooking && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingServiceBooking.status}
                                    onChange={(e) =>
                                      setEditingServiceBooking({
                                        ...editingServiceBooking,
                                        status: e.target.value as ServiceBooking["status"],
                                      })
                                    }
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Scheduled Date</Label>
                                  <Input
                                    type="date"
                                    value={editingServiceBooking.scheduledDate ?? ""}
                                    onChange={(e) =>
                                      setEditingServiceBooking({
                                        ...editingServiceBooking,
                                        scheduledDate: e.target.value || null,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Notes</Label>
                                  <Textarea
                                    value={editingServiceBooking.notes ?? ""}
                                    onChange={(e) =>
                                      setEditingServiceBooking({
                                        ...editingServiceBooking,
                                        notes: e.target.value || null,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveServiceBooking}>
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default AdminServiceBookingsTab;
