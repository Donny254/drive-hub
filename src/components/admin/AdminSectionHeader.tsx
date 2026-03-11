import { ReactNode } from "react";

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  stats?: ReactNode;
  actions?: ReactNode;
  controls?: ReactNode;
};

const AdminSectionHeader = ({
  title,
  description,
  stats,
  actions,
  controls,
}: AdminSectionHeaderProps) => {
  return (
    <div className="border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {stats ? <div className="flex flex-wrap gap-2">{stats}</div> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {controls ? <div className="mt-4 flex flex-wrap items-center gap-3">{controls}</div> : null}
    </div>
  );
};

export default AdminSectionHeader;
