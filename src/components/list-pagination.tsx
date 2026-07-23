"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const LIST_PAGE_SIZE = 10;

export function getPageCount(totalItems: number, pageSize = LIST_PAGE_SIZE) {
  if (totalItems <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize = LIST_PAGE_SIZE,
): T[] {
  const safePage = Math.min(Math.max(page, 1), getPageCount(items.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function pageNumbers(current: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount, current]);
  for (let i = current - 1; i <= current + 1; i += 1) {
    if (i >= 1 && i <= pageCount) {
      pages.add(i);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i]!;
    if (i > 0 && value - sorted[i - 1]! > 1) {
      result.push("ellipsis");
    }
    result.push(value);
  }
  return result;
}

export function ListPagination({
  page,
  totalItems,
  pageSize = LIST_PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = getPageCount(totalItems, pageSize);
  if (pageCount <= 1) {
    return null;
  }
  const current = Math.min(Math.max(page, 1), pageCount);
  const numbers = pageNumbers(current, pageCount);

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              disabled={current <= 1}
              onClick={() => onPageChange(current - 1)}
            />
          </PaginationItem>
          {numbers.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  isActive={item === current}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              disabled={current >= pageCount}
              onClick={() => onPageChange(current + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <p className="text-xs text-[var(--muted-foreground)]">
        第 {current}／{pageCount} 頁 · 共 {totalItems} 筆
      </p>
    </div>
  );
}
