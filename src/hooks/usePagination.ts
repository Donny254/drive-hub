import { useMemo, useState } from "react";

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const reset = () => setPage(1);

  return { pageItems, page: safePage, totalPages, goTo, reset };
}
