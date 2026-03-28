import type { DeleteTarget } from "@/components/admin/types";
import ActionConfirmDialog from "@/components/shared/ActionConfirmDialog";

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
  const itemLabel = deleteTarget?.kind || "item";

  return (
    <ActionConfirmDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title={`Delete ${itemLabel}?`}
      description={
        deleteTarget
          ? `This will permanently remove ${deleteTarget.kind} "${deleteTarget.label}". This action cannot be undone.`
          : "This action cannot be undone."
      }
      cancelLabel={`Keep ${itemLabel}`}
      confirmLabel={`Delete ${itemLabel}`}
      onConfirm={confirmSingleDelete}
    />
  );
};

export default AdminDeleteConfirmDialog;
