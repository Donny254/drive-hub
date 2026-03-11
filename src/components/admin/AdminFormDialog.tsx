import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AdminFormDialogProps = {
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  actionDisabled?: boolean;
};

const AdminFormDialog = ({
  title,
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
}: AdminFormDialogProps) => {
  return (
    <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b border-border px-6 py-4">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 overflow-y-auto px-6 py-4">
        {children}
      </div>
      <DialogFooter className="border-t border-border bg-background px-6 py-4">
        <Button variant="hero" onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default AdminFormDialog;
