import type { DeleteTarget } from "@/components/admin/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdminDeleteConfirmDialogProps = {
  deleteTarget: DeleteTarget;
  setDeleteTarget: (target: DeleteTarget) => void;
  confirmSingleDelete: () => Promise<void> | void;
};

const AdminDeleteConfirmDialog = ({
  deleteTarget,
  setDeleteTarget,
  confirmSingleDelete,
}: AdminDeleteConfirmDialogProps) => {
  return (
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget
              ? `This will permanently remove ${deleteTarget.kind} "${deleteTarget.label}".`
              : "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmSingleDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminDeleteConfirmDialog;
