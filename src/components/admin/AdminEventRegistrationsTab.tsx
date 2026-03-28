import type { Dispatch, SetStateAction } from "react";
import type { EventRegistration } from "@/components/admin/types";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AdminEventRegistrationsTabProps = {
  eventRegistrations: EventRegistration[];
  editingEventRegistration: EventRegistration | null;
  setEditingEventRegistration: Dispatch<SetStateAction<EventRegistration | null>>;
  saveEventRegistration: () => Promise<void> | void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
};

const AdminEventRegistrationsTab = ({
  eventRegistrations,
  editingEventRegistration,
  setEditingEventRegistration,
  saveEventRegistration,
  statusVariant,
}: AdminEventRegistrationsTabProps) => {
  return (
    <TabsContent value="event-registrations" className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Event Registrations</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Monitor attendance requests, ticket counts, and registration state in a cleaner queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {eventRegistrations.length} total
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {eventRegistrations.filter((registration) => registration.status === "pending").length} pending
              </div>
              <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                {eventRegistrations.filter((registration) => registration.status === "confirmed").length} confirmed
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registration</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRegistrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {registration.eventTitle ?? registration.eventId.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registration {registration.id.slice(0, 8)} • User{" "}
                          {registration.userId?.slice(0, 8) ?? "--"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{registration.tickets}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(registration.status)} className="capitalize">
                        {registration.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingEventRegistration?.id === registration.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingEventRegistration(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingEventRegistration({ ...registration })}
                            >
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Event Registration</DialogTitle>
                              <DialogDescription>
                                Adjust the registration status, attendee ticket count, or notes for this event booking.
                              </DialogDescription>
                            </DialogHeader>
                            {editingEventRegistration && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Status</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingEventRegistration.status}
                                    onChange={(e) =>
                                      setEditingEventRegistration({
                                        ...editingEventRegistration,
                                        status: e.target.value as EventRegistration["status"],
                                      })
                                    }
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Tickets</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={editingEventRegistration.tickets}
                                    onChange={(e) =>
                                      setEditingEventRegistration({
                                        ...editingEventRegistration,
                                        tickets: Math.max(1, Number(e.target.value || 1)),
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Notes</Label>
                                  <Textarea
                                    value={editingEventRegistration.notes ?? ""}
                                    onChange={(e) =>
                                      setEditingEventRegistration({
                                        ...editingEventRegistration,
                                        notes: e.target.value || null,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveEventRegistration}>
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

export default AdminEventRegistrationsTab;
