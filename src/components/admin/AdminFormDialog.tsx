import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AdminFormDialogProps = {
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  actionDisabled?: boolean;
  description?: string;
};

const AdminFormDialog = ({
  title,
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
  description,
}: AdminFormDialogProps) => {
  return (
    <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b border-border px-6 py-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description || `${title}. Review the fields below, then choose ${actionLabel.toLowerCase()}.`}
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-4">
          {children}
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
        <Button variant="hero" onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default AdminFormDialog;
