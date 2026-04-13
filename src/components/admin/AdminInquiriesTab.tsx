import AdminBulkActionBar from "@/components/admin/AdminBulkActionBar";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminTablePagination from "@/components/admin/AdminTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Inquiry } from "@/components/admin/types";

type AdminInquiriesTabProps = {
  inquiries: Inquiry[];
  filteredInquiries: Inquiry[];
  paginatedInquiries: Inquiry[];
  inquiryStatusFilter: Inquiry["status"] | "all";
  setInquiryStatusFilter: (value: Inquiry["status"] | "all") => void;
  selectedInquiryIds: string[];
  setSelectedInquiryIds: React.Dispatch<React.SetStateAction<string[]>>;
  editingInquiry: Inquiry | null;
  setEditingInquiry: React.Dispatch<React.SetStateAction<Inquiry | null>>;
  bulkHandleInquiries: () => Promise<void>;
  saveInquiry: () => Promise<void>;
  inquiriesPage: number;
  inquiriesPageCount: number;
  setInquiriesPage: React.Dispatch<React.SetStateAction<number>>;
  toggleSelection: (
    id: string,
    selected: string[],
    setSelected: (ids: string[]) => void,
  ) => void;
  statusVariant: (status?: string | null) => "default" | "secondary" | "destructive" | "outline";
  formatDate: (value?: string | null) => string;
};

const AdminInquiriesTab = ({
  inquiries,
  filteredInquiries,
  paginatedInquiries,
  inquiryStatusFilter,
  setInquiryStatusFilter,
  selectedInquiryIds,
  setSelectedInquiryIds,
  editingInquiry,
  setEditingInquiry,
  bulkHandleInquiries,
  saveInquiry,
  inquiriesPage,
  inquiriesPageCount,
  setInquiriesPage,
  toggleSelection,
  statusVariant,
  formatDate,
}: AdminInquiriesTabProps) => {
  return (
    <div className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <AdminSectionHeader
            title="Inquiries Inbox"
            description="Keep lead handling focused by grouping contact details and message context together."
            stats={
              <>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {inquiries.length} total
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {inquiries.filter((inquiry) => inquiry.status === "open").length} open
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {inquiries.filter((inquiry) => inquiry.status === "handled").length} handled
                </div>
              </>
            }
            controls={
              <>
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Filter
                </Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={inquiryStatusFilter}
                  onChange={(e) => setInquiryStatusFilter(e.target.value as Inquiry["status"] | "all")}
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="handled">Handled</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Showing {paginatedInquiries.length} of {filteredInquiries.length} inquiries
                </p>
              </>
            }
          />
          <AdminBulkActionBar count={selectedInquiryIds.length}>
            <Button variant="hero" size="sm" onClick={bulkHandleInquiries}>
              Mark Handled
            </Button>
          </AdminBulkActionBar>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:hidden">
            {paginatedInquiries.map((inquiry) => (
              <div key={inquiry.id} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium break-words">{inquiry.name ?? "--"}</p>
                      <Badge variant="secondary" className="capitalize">
                        {inquiry.inquiryType}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground break-all">
                      {inquiry.email ?? "--"} • {inquiry.phone ?? "--"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedInquiryIds.includes(inquiry.id)}
                    onChange={() => toggleSelection(inquiry.id, selectedInquiryIds, setSelectedInquiryIds)}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground break-words">
                  {inquiry.listingTitle ?? (inquiry.listingId ? inquiry.listingId.slice(0, 8) : "--")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground break-words">{inquiry.message ?? "--"}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{formatDate(inquiry.createdAt)}</span>
                  <Badge variant={statusVariant(inquiry.status)} className="capitalize">
                    {inquiry.status}
                  </Badge>
                </div>
                <Dialog
                  open={editingInquiry?.id === inquiry.id}
                  onOpenChange={(open) => {
                    if (!open) setEditingInquiry(null);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setEditingInquiry({ ...inquiry })}
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Inquiry</DialogTitle>
                      <DialogDescription>
                        Update the handling status for this inquiry after reviewing the customer’s message.
                      </DialogDescription>
                    </DialogHeader>
                    {editingInquiry && (
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Status</Label>
                          <select
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            value={editingInquiry.status}
                            onChange={(e) =>
                              setEditingInquiry({
                                ...editingInquiry,
                                status: e.target.value as Inquiry["status"],
                              })
                            }
                          >
                            <option value="open">Open</option>
                            <option value="handled">Handled</option>
                          </select>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="hero" onClick={saveInquiry}>
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
          <div className="hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedInquiries.length > 0 &&
                        paginatedInquiries.every((inquiry) => selectedInquiryIds.includes(inquiry.id))
                      }
                      onChange={(e) =>
                        setSelectedInquiryIds(
                          e.target.checked
                            ? Array.from(
                                new Set([
                                  ...selectedInquiryIds,
                                  ...paginatedInquiries.map((inquiry) => inquiry.id),
                                ]),
                              )
                            : selectedInquiryIds.filter(
                                (id) => !paginatedInquiries.some((inquiry) => inquiry.id === id),
                              ),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Inquiry</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedInquiryIds.includes(inquiry.id)}
                        onChange={() =>
                          toggleSelection(inquiry.id, selectedInquiryIds, setSelectedInquiryIds)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{inquiry.name ?? "--"}</p>
                          <Badge variant="secondary" className="capitalize">
                            {inquiry.inquiryType}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {inquiry.email ?? "--"} • {inquiry.phone ?? "--"}
                        </p>
                        <p className="mt-2 max-w-xs text-xs text-muted-foreground line-clamp-2">
                          {inquiry.message ?? "--"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inquiry.listingTitle ?? (inquiry.listingId ? inquiry.listingId.slice(0, 8) : "--")}
                    </TableCell>
                    <TableCell>{formatDate(inquiry.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(inquiry.status)} className="capitalize">
                        {inquiry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog
                        open={editingInquiry?.id === inquiry.id}
                        onOpenChange={(open) => {
                          if (!open) setEditingInquiry(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingInquiry({ ...inquiry })}
                          >
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Inquiry</DialogTitle>
                            <DialogDescription>
                              Update the handling status for this inquiry after reviewing the customer’s message.
                            </DialogDescription>
                          </DialogHeader>
                          {editingInquiry && (
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <Label>Status</Label>
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={editingInquiry.status}
                                  onChange={(e) =>
                                    setEditingInquiry({
                                      ...editingInquiry,
                                      status: e.target.value as Inquiry["status"],
                                    })
                                  }
                                >
                                  <option value="open">Open</option>
                                  <option value="handled">Handled</option>
                                </select>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button variant="hero" onClick={saveInquiry}>
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminTablePagination
            page={inquiriesPage}
            pageCount={inquiriesPageCount}
            onPrevious={() => setInquiriesPage((page) => Math.max(1, page - 1))}
            onNext={() => setInquiriesPage((page) => Math.min(inquiriesPageCount, page + 1))}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInquiriesTab;
