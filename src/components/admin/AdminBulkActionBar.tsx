import { ReactNode } from "react";

type AdminBulkActionBarProps = {
  count: number;
  children: ReactNode;
};

const AdminBulkActionBar = ({ count, children }: AdminBulkActionBarProps) => {
  if (count <= 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        {count} selected
      </div>
      {children}
    </div>
  );
};

export default AdminBulkActionBar;
