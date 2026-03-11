import { Button } from "@/components/ui/button";

type AdminTablePaginationProps = {
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
};

const AdminTablePagination = ({
  page,
  pageCount,
  onPrevious,
  onNext,
}: AdminTablePaginationProps) => {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page === pageCount} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default AdminTablePagination;
