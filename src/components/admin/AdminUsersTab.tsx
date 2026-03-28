import AdminBulkActionBar from "@/components/admin/AdminBulkActionBar";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminTablePagination from "@/components/admin/AdminTablePagination";
import type { DeleteTarget, User } from "@/components/admin/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminUsersTabProps = {
  users: User[];
  filteredUsers: User[];
  paginatedUsers: User[];
  userSearch: string;
  setUserSearch: React.Dispatch<React.SetStateAction<string>>;
  userVerificationFilter: User["sellerVerificationStatus"] | "all";
  setUserVerificationFilter: (value: User["sellerVerificationStatus"] | "all") => void;
  selectedUserIds: string[];
  setSelectedUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  editingUser: User | null;
  setEditingUser: React.Dispatch<React.SetStateAction<User | null>>;
  bulkVerifyUsers: () => Promise<void>;
  setConfirmBulkDeleteUsersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveUser: () => Promise<void>;
  usersPage: number;
  usersPageCount: number;
  setUsersPage: React.Dispatch<React.SetStateAction<number>>;
  setDeleteTarget: React.Dispatch<React.SetStateAction<DeleteTarget>>;
  toggleSelection: (
    id: string,
    selected: string[],
    setSelected: (ids: string[]) => void,
  ) => void;
};

const AdminUsersTab = ({
  users,
  filteredUsers,
  paginatedUsers,
  userSearch,
  setUserSearch,
  userVerificationFilter,
  setUserVerificationFilter,
  selectedUserIds,
  setSelectedUserIds,
  editingUser,
  setEditingUser,
  bulkVerifyUsers,
  setConfirmBulkDeleteUsersOpen,
  saveUser,
  usersPage,
  usersPageCount,
  setUsersPage,
  setDeleteTarget,
  toggleSelection,
}: AdminUsersTabProps) => {
  return (
    <div className="mt-6">
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <AdminSectionHeader
            title="Users Workspace"
            description="Search accounts quickly and manage seller verification without scanning a wide user grid."
            stats={
              <>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {users.length} users
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {users.filter((user) => user.role === "admin").length} admins
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  {users.filter((user) => user.sellerVerificationStatus === "verified").length} verified
                </div>
              </>
            }
            controls={
              <>
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, phone, role, or verification"
                  className="max-w-md"
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={userVerificationFilter}
                  onChange={(e) =>
                    setUserVerificationFilter(
                      e.target.value as User["sellerVerificationStatus"] | "all",
                    )
                  }
                >
                  <option value="all">All verification</option>
                  <option value="unverified">Unverified</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Showing {paginatedUsers.length} of {filteredUsers.length} users
                </p>
              </>
            }
          />
          <AdminBulkActionBar count={selectedUserIds.length}>
            <Button variant="hero" size="sm" onClick={bulkVerifyUsers}>
              Verify Selected
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulkDeleteUsersOpen(true)}
            >
              Delete Selected
            </Button>
          </AdminBulkActionBar>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:hidden">
            {paginatedUsers.map((user) => (
              <div key={user.id} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{user.name ?? "--"}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-all">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-words">{user.phone ?? "--"}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => toggleSelection(user.id, selectedUserIds, setSelectedUserIds)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Badge
                    variant={
                      user.sellerVerificationStatus === "verified"
                        ? "default"
                        : user.sellerVerificationStatus === "pending"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {user.sellerVerificationStatus}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Dialog
                    open={editingUser?.id === user.id}
                    onOpenChange={(open) => {
                      if (!open) setEditingUser(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditingUser({ ...user })}
                      >
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                          Update this account’s contact details, role, or seller verification status before saving.
                        </DialogDescription>
                      </DialogHeader>
                      {editingUser && (
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input
                              value={editingUser.name ?? ""}
                              onChange={(e) =>
                                setEditingUser({ ...editingUser, name: e.target.value })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Phone</Label>
                            <Input
                              value={editingUser.phone ?? ""}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  phone: e.target.value || null,
                                })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Role</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingUser.role}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  role: e.target.value as User["role"],
                                })
                              }
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Seller Verification</Label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              value={editingUser.sellerVerificationStatus}
                              onChange={(e) =>
                                setEditingUser({
                                  ...editingUser,
                                  sellerVerificationStatus: e.target.value as User["sellerVerificationStatus"],
                                })
                              }
                            >
                              <option value="unverified">Unverified</option>
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                            </select>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="hero" onClick={saveUser}>
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
                        kind: "user",
                        id: user.id,
                        label: user.email,
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
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedUsers.length > 0 &&
                        paginatedUsers.every((user) => selectedUserIds.includes(user.id))
                      }
                      onChange={(e) =>
                        setSelectedUserIds(
                          e.target.checked
                            ? Array.from(new Set([...selectedUserIds, ...paginatedUsers.map((user) => user.id)]))
                            : selectedUserIds.filter(
                                (id) => !paginatedUsers.some((user) => user.id === id),
                              ),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleSelection(user.id, selectedUserIds, setSelectedUserIds)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name ?? "--"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{user.phone ?? "--"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.sellerVerificationStatus === "verified"
                            ? "default"
                            : user.sellerVerificationStatus === "pending"
                              ? "secondary"
                              : "outline"
                        }
                        className="capitalize"
                      >
                        {user.sellerVerificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog
                          open={editingUser?.id === user.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingUser(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingUser({ ...user })}
                            >
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User</DialogTitle>
                              <DialogDescription>
                                Update this account’s contact details, role, or seller verification status before saving.
                              </DialogDescription>
                            </DialogHeader>
                            {editingUser && (
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label>Name</Label>
                                  <Input
                                    value={editingUser.name ?? ""}
                                    onChange={(e) =>
                                      setEditingUser({ ...editingUser, name: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Phone</Label>
                                  <Input
                                    value={editingUser.phone ?? ""}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        phone: e.target.value || null,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Role</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingUser.role}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        role: e.target.value as User["role"],
                                      })
                                    }
                                  >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Seller Verification</Label>
                                  <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                    value={editingUser.sellerVerificationStatus}
                                    onChange={(e) =>
                                      setEditingUser({
                                        ...editingUser,
                                        sellerVerificationStatus: e.target.value as User["sellerVerificationStatus"],
                                      })
                                    }
                                  >
                                    <option value="unverified">Unverified</option>
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                  </select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="hero" onClick={saveUser}>
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
                              kind: "user",
                              id: user.id,
                              label: user.email,
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
          <AdminTablePagination
            page={usersPage}
            pageCount={usersPageCount}
            onPrevious={() => setUsersPage((page) => Math.max(1, page - 1))}
            onNext={() => setUsersPage((page) => Math.min(usersPageCount, page + 1))}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersTab;
