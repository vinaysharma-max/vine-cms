export const DEFAULT_PUBLIC_API_PAGE_SIZE = 20;
export const MAX_PUBLIC_API_PAGE_SIZE = 100;

export type PublicApiPaginationArgs = {
  page?: number;
  pageSize?: number;
};

export type PublicApiPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  return normalized >= 1 ? normalized : fallback;
}

export function paginatePublicApiItems<T>(items: T[], args: PublicApiPaginationArgs) {
  const totalItems = items.length;
  const hasRequestedPagination = args.page !== undefined || args.pageSize !== undefined;

  if (!hasRequestedPagination) {
    return {
      items,
      pagination: {
        page: 1,
        pageSize: totalItems,
        totalItems,
        totalPages: totalItems === 0 ? 0 : 1,
        hasNextPage: false,
        hasPreviousPage: false,
      } satisfies PublicApiPagination,
    };
  }

  const page = normalizePositiveInteger(args.page, 1);
  const pageSize = Math.min(
    normalizePositiveInteger(args.pageSize, DEFAULT_PUBLIC_API_PAGE_SIZE),
    MAX_PUBLIC_API_PAGE_SIZE,
  );
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    } satisfies PublicApiPagination,
  };
}
